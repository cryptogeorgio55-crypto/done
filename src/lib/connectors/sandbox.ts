import { db } from "@/lib/db";
import type { NormalizedEvent } from "@/lib/events/types";

// Sandbox connectors let the ENTIRE DONE Loop run end-to-end without real
// provider credentials. Everything they surface is stored in ExternalEntity and
// clearly labelled sandbox in the UI, so nothing is faked as a real integration.
// When real OAuth creds exist the connector switches to `oauth` mode and calls
// the live API instead.

export interface DemoEmail {
  messageId: string;
  threadId: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
  ageMinutes: number;
}

/** A small, realistic inbox that exercises the classifier/policy/action paths. */
export function demoInbox(): DemoEmail[] {
  return [
    {
      messageId: "sbx-msg-1",
      threadId: "sbx-thr-1",
      from: "sarah@bellabeauty.co",
      fromName: "Sarah Haddad",
      subject: "Website for our salon?",
      body: "Hi! We run a small beauty salon and we're thinking about getting a proper website with online booking. How much would something like that cost, and how long does it take? Thanks, Sarah",
      ageMinutes: 140,
    },
    {
      messageId: "sbx-msg-2",
      threadId: "sbx-thr-2",
      from: "karim@nextlevelgym.io",
      fromName: "Karim Nasr",
      subject: "Quick call this week?",
      body: "Hey, loved the proposal. Can we schedule a call Thursday afternoon to go through the details? Thursday after 2pm works best for me.",
      ageMinutes: 55,
    },
    {
      messageId: "sbx-msg-3",
      threadId: "sbx-thr-3",
      from: "mona@shopmona.com",
      fromName: "Mona",
      subject: "Order #4821 — still waiting",
      body: "I placed order #4821 last week and I haven't heard anything about delivery. This is really frustrating, can someone please tell me what's going on?",
      ageMinutes: 20,
    },
  ];
}

interface MessageData {
  threadId: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  snippet: string;
  direction: "inbound" | "draft" | "sent";
  labels: string[];
  createdAt: string;
}

/**
 * Materialize the demo inbox as ExternalEntity message records the first time
 * we poll (tracked via SyncState) and return them as normalized events. On
 * subsequent polls nothing new is emitted — like a real incremental sync.
 */
export async function sandboxPollGmail(
  workspaceId: string,
  accountId: string
): Promise<NormalizedEvent[]> {
  const sync = await db.syncState.findUnique({
    where: { accountId_resource: { accountId, resource: "messages" } },
  });
  if (sync?.cursor === "seeded") return [];

  const inbox = demoInbox();
  const events: NormalizedEvent[] = [];
  for (const m of inbox) {
    const receivedAt = new Date(Date.now() - m.ageMinutes * 60_000);
    const data: MessageData = {
      threadId: m.threadId,
      from: m.from,
      fromName: m.fromName,
      to: "you@yourbusiness.com",
      subject: m.subject,
      body: m.body,
      snippet: m.body.slice(0, 140),
      direction: "inbound",
      labels: ["INBOX"],
      createdAt: receivedAt.toISOString(),
    };
    await db.externalEntity.upsert({
      where: {
        workspaceId_provider_kind_externalId: {
          workspaceId,
          provider: "gmail",
          kind: "message",
          externalId: m.messageId,
        },
      },
      create: {
        workspaceId,
        provider: "gmail",
        kind: "message",
        externalId: m.messageId,
        displayName: m.subject,
        email: m.from,
        data: data as unknown as object,
      },
      update: {},
    });
    events.push({
      type: "email.received",
      source: "gmail",
      dedupeKey: `gmail:${m.messageId}`,
      title: `${m.fromName}: ${m.subject}`,
      summary: data.snippet,
      occurredAt: receivedAt,
      entityId: m.messageId,
      payload: {
        messageId: m.messageId,
        threadId: m.threadId,
        from: m.from,
        fromName: m.fromName,
        to: data.to,
        subject: m.subject,
        snippet: data.snippet,
        body: m.body,
        receivedAt: receivedAt.toISOString(),
      },
    });
  }

  await db.syncState.upsert({
    where: { accountId_resource: { accountId, resource: "messages" } },
    create: { accountId, resource: "messages", cursor: "seeded", lastRunAt: new Date() },
    update: { cursor: "seeded", lastRunAt: new Date() },
  });
  return events;
}

/** Read a thread's messages from the sandbox store, oldest first. */
export async function sandboxReadThread(workspaceId: string, threadId: string) {
  const msgs = await db.externalEntity.findMany({
    where: { workspaceId, provider: "gmail", kind: "message" },
  });
  return msgs
    .map((m) => ({ id: m.externalId, data: m.data as unknown as MessageData }))
    .filter((m) => m.data?.threadId === threadId)
    .sort((a, b) => (a.data.createdAt < b.data.createdAt ? -1 : 1));
}

/** Keyword search across sandbox messages. */
export async function sandboxSearch(workspaceId: string, query: string) {
  const q = query.toLowerCase().trim();
  const msgs = await db.externalEntity.findMany({
    where: { workspaceId, provider: "gmail", kind: "message" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return msgs
    .map((m) => ({ id: m.externalId, data: m.data as unknown as MessageData }))
    .filter((m) => {
      if (!q) return true;
      const hay = `${m.data.from} ${m.data.subject} ${m.data.body}`.toLowerCase();
      return q.split(/\s+/).some((t) => hay.includes(t));
    })
    .slice(0, 20);
}

/** Persist an outbound message (draft or sent) into the sandbox store. */
export async function sandboxWriteMessage(
  workspaceId: string,
  msg: {
    messageId: string;
    threadId: string;
    to: string;
    subject: string;
    body: string;
    direction: "draft" | "sent";
  }
) {
  const data: MessageData = {
    threadId: msg.threadId,
    from: "you@yourbusiness.com",
    fromName: "You",
    to: msg.to,
    subject: msg.subject,
    body: msg.body,
    snippet: msg.body.slice(0, 140),
    direction: msg.direction,
    labels: msg.direction === "draft" ? ["DRAFT"] : ["SENT"],
    createdAt: new Date().toISOString(),
  };
  await db.externalEntity.upsert({
    where: {
      workspaceId_provider_kind_externalId: {
        workspaceId,
        provider: "gmail",
        kind: "message",
        externalId: msg.messageId,
      },
    },
    create: {
      workspaceId,
      provider: "gmail",
      kind: "message",
      externalId: msg.messageId,
      displayName: msg.subject,
      email: msg.to,
      data: data as unknown as object,
    },
    update: { data: data as unknown as object },
  });
  return { messageId: msg.messageId, threadId: msg.threadId };
}
