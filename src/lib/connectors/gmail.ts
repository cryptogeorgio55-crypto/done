import { z } from "zod";
import { randomUUID } from "crypto";
import { AppError } from "@/lib/errors";
import type { Capability, CapabilityCallContext, Connector } from "./types";
import type { NormalizedEvent } from "@/lib/events/types";
import {
  sandboxPollGmail,
  sandboxReadThread,
  sandboxSearch,
  sandboxWriteMessage,
} from "./sandbox";
import { getValidGoogleAccessToken } from "./google-oauth";

const searchInput = z.object({ query: z.string().max(200).default("") });
const threadInput = z.object({ threadId: z.string() });
const sendInput = z.object({
  threadId: z.string().optional(),
  to: z.string().email(),
  subject: z.string().max(300),
  body: z.string().max(8000),
});
const labelInput = z.object({ messageId: z.string(), label: z.string().max(60) });

export const gmailConnector: Connector = {
  key: "gmail",
  name: "Gmail",
  category: "communication",
  phase: 1,
  description: "Read customer email, understand intent, draft and send replies.",
  permissions: [
    "Read messages in your inbox",
    "Search email and read threads",
    "Create drafts",
    "Send replies (only when you allow it)",
    "Apply labels",
  ],
  capabilities: [
    "gmail.search_messages",
    "gmail.read_thread",
    "gmail.create_draft",
    "gmail.send_message",
    "gmail.label_message",
  ],
  implemented: true,
  oauth: true,

  async poll(cc: CapabilityCallContext): Promise<NormalizedEvent[]> {
    if (cc.config.mode === "oauth") return pollGmailApi(cc.accountId, cc.ctx.workspace.id);
    return sandboxPollGmail(cc.ctx.workspace.id, cc.accountId);
  },

  async health(cc) {
    if (cc.config.mode === "oauth") {
      const token = await getValidGoogleAccessToken(cc.accountId).catch(() => null);
      return token
        ? { status: "ok" as const }
        : { status: "down" as const, detail: "Reconnect required." };
    }
    return { status: "ok" as const, detail: "Sandbox mode." };
  },

  async invoke(cc, capability: Capability, rawInput: unknown): Promise<unknown> {
    const wsId = cc.ctx.workspace.id;
    const oauth = cc.config.mode === "oauth";
    switch (capability) {
      case "gmail.search_messages": {
        const { query } = searchInput.parse(rawInput);
        if (oauth) return searchGmailApi(cc.accountId, query);
        const results = await sandboxSearch(wsId, query);
        return {
          messages: results.map((m) => ({
            messageId: m.id,
            threadId: m.data.threadId,
            from: m.data.from,
            subject: m.data.subject,
            snippet: m.data.snippet,
            direction: m.data.direction,
          })),
        };
      }
      case "gmail.read_thread": {
        const { threadId } = threadInput.parse(rawInput);
        if (oauth) return readThreadApi(cc.accountId, threadId);
        const msgs = await sandboxReadThread(wsId, threadId);
        return {
          threadId,
          messages: msgs.map((m) => ({
            messageId: m.id,
            from: m.data.from,
            fromName: m.data.fromName,
            subject: m.data.subject,
            body: m.data.body,
            direction: m.data.direction,
            createdAt: m.data.createdAt,
          })),
        };
      }
      case "gmail.create_draft": {
        const input = sendInput.parse(rawInput);
        if (oauth) return createDraftApi(cc.accountId, input);
        return sandboxWriteMessage(wsId, {
          messageId: `draft-${randomUUID().slice(0, 8)}`,
          threadId: input.threadId || `thr-${randomUUID().slice(0, 8)}`,
          to: input.to,
          subject: input.subject,
          body: input.body,
          direction: "draft",
        });
      }
      case "gmail.send_message": {
        const input = sendInput.parse(rawInput);
        if (oauth) return sendViaGmailApi(cc.accountId, input);
        return sandboxWriteMessage(wsId, {
          messageId: `sent-${randomUUID().slice(0, 8)}`,
          threadId: input.threadId || `thr-${randomUUID().slice(0, 8)}`,
          to: input.to,
          subject: input.subject,
          body: input.body,
          direction: "sent",
        });
      }
      case "gmail.label_message": {
        const input = labelInput.parse(rawInput);
        if (oauth) return labelMessageApi(cc.accountId, input.messageId, input.label);
        return { ok: true };
      }
      default:
        throw new AppError("capability_unsupported", `Gmail cannot ${capability}.`, 400);
    }
  },
};

// --------------------------------------------------------------------------
// Real Gmail REST API (oauth mode). Docs: developers.google.com/gmail/api
// --------------------------------------------------------------------------

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailGet<T>(accountId: string, path: string): Promise<T> {
  const token = await getValidGoogleAccessToken(accountId);
  const res = await fetch(`${GMAIL_BASE}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new AppError("gmail_api_error", `Gmail request failed (${res.status}).`, 502);
  return (await res.json()) as T;
}

async function gmailPost<T>(accountId: string, path: string, body: unknown): Promise<T> {
  const token = await getValidGoogleAccessToken(accountId);
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new AppError("gmail_api_error", `Gmail request failed (${res.status}).`, 502);
  return (await res.json()) as T;
}

interface GmailHeader { name: string; value: string }
interface GmailPart { mimeType?: string; body?: { data?: string; size?: number }; parts?: GmailPart[] }
interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: GmailHeader[]; mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
}

function header(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Split "Sarah Haddad <sarah@x.com>" into a name and an email. */
function parseFrom(from: string): { email: string; name: string } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2], email: m[2].trim() };
  return { name: from.trim(), email: from.trim() };
}

function decodeB64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

/** Walk a MIME tree and return the first text/plain body (falls back to html-stripped). */
function extractBody(payload: GmailMessage["payload"]): string {
  if (!payload) return "";
  const walk = (part: GmailPart): string | null => {
    if (part.mimeType === "text/plain" && part.body?.data) return decodeB64Url(part.body.data);
    if (part.parts) {
      for (const p of part.parts) {
        const found = walk(p);
        if (found) return found;
      }
    }
    return null;
  };
  const fromParts = payload.parts ? walk({ parts: payload.parts, mimeType: payload.mimeType }) : null;
  if (fromParts) return fromParts;
  if (payload.body?.data) {
    const raw = decodeB64Url(payload.body.data);
    return payload.mimeType === "text/html" ? raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : raw;
  }
  return "";
}

interface GmailListResponse { messages?: { id: string; threadId: string }[] }

/** Incremental inbox poll → normalized email.received events. Bus dedupes by key. */
async function pollGmailApi(accountId: string, _workspaceId: string): Promise<NormalizedEvent[]> {
  const list = await gmailGet<GmailListResponse>(accountId, "/messages?q=" + encodeURIComponent("in:inbox newer_than:2d -from:me") + "&maxResults=15");
  const ids = (list.messages ?? []).map((m) => m.id);
  const events: NormalizedEvent[] = [];
  for (const id of ids) {
    const msg = await gmailGet<GmailMessage>(accountId, `/messages/${id}?format=full`);
    const from = parseFrom(header(msg.payload?.headers, "From"));
    const subject = header(msg.payload?.headers, "Subject") || "(no subject)";
    const body = extractBody(msg.payload);
    const receivedAt = msg.internalDate ? new Date(Number(msg.internalDate)) : new Date();
    events.push({
      type: "email.received",
      source: "gmail",
      dedupeKey: `gmail:${msg.id}`,
      title: `${from.name}: ${subject}`,
      summary: (msg.snippet ?? body).slice(0, 140),
      occurredAt: receivedAt,
      entityId: msg.id,
      payload: {
        messageId: msg.id,
        threadId: msg.threadId,
        from: from.email,
        fromName: from.name,
        to: "me",
        subject,
        snippet: (msg.snippet ?? body).slice(0, 140),
        body,
        receivedAt: receivedAt.toISOString(),
      },
    });
  }
  return events;
}

async function searchGmailApi(accountId: string, query: string) {
  const list = await gmailGet<GmailListResponse>(accountId, "/messages?maxResults=20&q=" + encodeURIComponent(query || "in:inbox"));
  const ids = (list.messages ?? []).slice(0, 12).map((m) => m.id);
  const messages = [];
  for (const id of ids) {
    const msg = await gmailGet<GmailMessage>(accountId, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
    const from = parseFrom(header(msg.payload?.headers, "From"));
    messages.push({
      messageId: msg.id,
      threadId: msg.threadId,
      from: from.email,
      subject: header(msg.payload?.headers, "Subject"),
      snippet: msg.snippet ?? "",
      direction: "inbound" as const,
    });
  }
  return { messages };
}

async function readThreadApi(accountId: string, threadId: string) {
  const thread = await gmailGet<{ messages?: GmailMessage[] }>(accountId, `/threads/${threadId}?format=full`);
  const messages = (thread.messages ?? []).map((msg) => {
    const from = parseFrom(header(msg.payload?.headers, "From"));
    return {
      messageId: msg.id,
      from: from.email,
      fromName: from.name,
      subject: header(msg.payload?.headers, "Subject"),
      body: extractBody(msg.payload),
      direction: "inbound" as const,
      createdAt: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString(),
    };
  });
  return { threadId, messages };
}

function encodeRaw(input: z.infer<typeof sendInput>): string {
  return Buffer.from(
    [
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      input.body,
    ].join("\r\n")
  ).toString("base64url");
}

async function createDraftApi(accountId: string, input: z.infer<typeof sendInput>) {
  const json = await gmailPost<{ id: string; message?: { id: string; threadId?: string } }>(accountId, "/drafts", {
    message: { raw: encodeRaw(input), threadId: input.threadId },
  });
  return { messageId: json.message?.id ?? json.id, threadId: json.message?.threadId };
}

async function labelMessageApi(accountId: string, messageId: string, label: string) {
  // Resolve (or create) a user label, then apply it.
  const { labels = [] } = await gmailGet<{ labels?: { id: string; name: string }[] }>(accountId, "/labels");
  let target = labels.find((l) => l.name.toLowerCase() === label.toLowerCase());
  if (!target) {
    target = await gmailPost<{ id: string; name: string }>(accountId, "/labels", {
      name: label,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    });
  }
  await gmailPost(accountId, `/messages/${messageId}/modify`, { addLabelIds: [target.id] });
  return { ok: true, labelId: target.id };
}

/** Real Gmail send via the REST API. */
async function sendViaGmailApi(
  accountId: string,
  input: z.infer<typeof sendInput>
): Promise<{ messageId: string; threadId?: string }> {
  const json = await gmailPost<{ id: string; threadId?: string }>(accountId, "/messages/send", {
    raw: encodeRaw(input),
    threadId: input.threadId,
  });
  return { messageId: json.id, threadId: json.threadId };
}
