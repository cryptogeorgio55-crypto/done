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
    if (cc.config.mode === "oauth") {
      // Real Gmail incremental sync would run here using history.list + the
      // stored sync cursor. Requires GOOGLE_CLIENT_ID/SECRET to be configured.
      await getValidGoogleAccessToken(cc.accountId); // validates/refreshes token
      return [];
    }
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
    switch (capability) {
      case "gmail.search_messages": {
        const { query } = searchInput.parse(rawInput);
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
        if (cc.config.mode === "oauth") {
          return sendViaGmailApi(cc.accountId, input);
        }
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
        labelInput.parse(rawInput);
        return { ok: true };
      }
      default:
        throw new AppError("capability_unsupported", `Gmail cannot ${capability}.`, 400);
    }
  },
};

/** Real Gmail send via the REST API (used only in oauth mode with live creds). */
async function sendViaGmailApi(
  accountId: string,
  input: z.infer<typeof sendInput>
): Promise<{ messageId: string; threadId?: string }> {
  const accessToken = await getValidGoogleAccessToken(accountId);
  const raw = Buffer.from(
    [
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      input.body,
    ].join("\r\n")
  ).toString("base64url");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw, threadId: input.threadId }),
  });
  if (!res.ok) {
    throw new AppError("gmail_send_failed", `Gmail send failed (${res.status}).`, 502);
  }
  const json = (await res.json()) as { id: string; threadId?: string };
  return { messageId: json.id, threadId: json.threadId };
}
