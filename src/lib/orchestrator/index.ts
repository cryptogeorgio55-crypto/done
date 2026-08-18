import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";
import { buildBusinessContext, renderContext } from "@/lib/ai/context";
import { getAutonomyConfig } from "@/lib/autonomy/settings";
import { executeAction, type ExecutionOutcome } from "@/lib/tools/executor";
import { emailReceivedPayload, calendarEventPayload } from "@/lib/events/types";
import {
  understandEmail,
  intentToCategory,
  intentToActionCategory,
} from "./understand";
import { draftReply } from "./reply";
import { recordCommitments } from "@/lib/commitments/tracker";

// THE DONE LOOP.
//
// Observe → Understand → Decide → Act → Verify → Remember → Follow up → Report.
//
// Planner / Policy / Executor / Verifier / Reporter are separated: the planner
// (understand + decide below) proposes actions; the policy engine + executor
// decide and perform them; this function verifies, records memory, and reports.
// Hard budgets bound every run so there are no runaway loops.

const MAX_ACTIONS = 6;

export interface LoopResult {
  runId: string;
  status: "completed" | "needs_approval" | "failed";
  summary: string;
  message: string;
  actionsDone: number;
  approvals: number;
  offline: boolean;
}

/** Process a single stored event through the loop. Idempotent per event status. */
export async function processEvent(ctx: WorkspaceContext, eventId: string): Promise<LoopResult | null> {
  const event = await db.event.findFirst({
    where: { id: eventId, workspaceId: ctx.workspace.id },
  });
  if (!event) return null;
  if (event.status === "processed" || event.status === "ignored" || event.status === "processing") return null;

  await db.event.update({ where: { id: event.id }, data: { status: "processing" } });

  const run = await db.automationRun.create({
    data: {
      workspaceId: ctx.workspace.id,
      trigger: "event",
      eventId: event.id,
      status: "running",
    },
  });

  try {
    let result: LoopResult;
    if (event.type === "email.received") {
      result = await handleEmail(ctx, run.id, event.payload);
    } else if (event.type === "calendar.event_starting") {
      result = await handleMeetingStarting(ctx, run.id, event.payload);
    } else {
      result = { runId: run.id, status: "completed", summary: "No action needed.", message: "Nothing to do.", actionsDone: 0, approvals: 0, offline: true };
    }

    await db.event.update({
      where: { id: event.id },
      data: {
        status: result.status === "failed" ? "failed" : result.summary === "Ignored spam." ? "ignored" : "processed",
        processedAt: new Date(),
        runId: run.id,
        category: (event.category as string) || undefined,
      },
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Loop failed";
    await db.automationRun.update({ where: { id: run.id }, data: { status: "failed", error: message, finishedAt: new Date() } });
    await db.event.update({ where: { id: event.id }, data: { status: "failed", error: message } });
    return { runId: run.id, status: "failed", summary: message, message: "Something went wrong.", actionsDone: 0, approvals: 0, offline: false };
  }
}

/** Run the loop for all new events (bounded). Returns per-event results. */
export async function processNewEvents(ctx: WorkspaceContext, limit = 10): Promise<LoopResult[]> {
  const events = await db.event.findMany({
    where: { workspaceId: ctx.workspace.id, status: "new" },
    orderBy: { occurredAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const results: LoopResult[] = [];
  for (const e of events) {
    const r = await processEvent(ctx, e.id);
    if (r) results.push(r);
  }
  return results;
}

// --- Email handler ---------------------------------------------------------

async function handleEmail(ctx: WorkspaceContext, runId: string, rawPayload: unknown): Promise<LoopResult> {
  const email = emailReceivedPayload.parse(rawPayload);
  const bctx = await buildBusinessContext(ctx.workspace.id);
  const businessContext = renderContext(bctx);
  const config = await getAutonomyConfig(ctx.workspace.id);

  // UNDERSTAND
  const { classification, offline, injectionDetected } = await understandEmail(email, businessContext);
  const category = intentToCategory(classification.intent);

  // Update the source event with the classification for the Inbox.
  await db.event.updateMany({
    where: { workspaceId: ctx.workspace.id, dedupeKey: `gmail:${email.messageId}` },
    data: { category, urgency: classification.urgency, confidence: classification.confidence, summary: classification.summary },
  });

  // Spam → ignore, no action.
  if (classification.intent === "spam") {
    await finishRun(ctx, runId, { intent: "spam", summary: "Ignored spam.", message: "Ignored a spam email.", planned: 0, done: 0, approvals: 0, offline });
    return { runId, status: "completed", summary: "Ignored spam.", message: "Ignored a spam email.", actionsDone: 0, approvals: 0, offline };
  }

  const outcomes: ExecutionOutcome[] = [];
  let seq = 0;
  let leadId: string | undefined;

  // DECIDE + ACT ------------------------------------------------------------

  // 1. Create/link a lead for sales & scheduling inquiries.
  if (classification.isLead || classification.intent === "sales_inquiry" || classification.intent === "scheduling") {
    const o = await executeAction(ctx, {
      tool: "create_lead", runId, seq: seq++,
      input: { name: classification.personName || email.fromName || email.from, email: email.from, source: "gmail", notes: classification.summary },
      reason: "New inbound inquiry from email.",
    });
    outcomes.push(o);
    leadId = (o.output as { leadId?: string } | undefined)?.leadId;
    if (leadId) await linkMessageToLead(ctx.workspace.id, email.messageId, leadId, email.from, classification.personName);
  }

  // 2. Scheduling → check availability so the reply can propose times.
  let proposedSlots: string[] = [];
  if (classification.intent === "scheduling") {
    const avail = await executeAction(ctx, {
      tool: "check_availability", runId, seq: seq++, input: { durationMins: 30 },
      reason: "Customer asked to schedule.",
    });
    outcomes.push(avail);
    const out = avail.output as { freeSlots?: string[] } | undefined;
    proposedSlots = out?.freeSlots?.slice(0, 3) ?? [];
  }

  // 3. Draft the reply (grounded in knowledge; never sends by itself).
  const { reply } = await draftReply(ctx, email, classification, businessContext, config.senderName, config.signature);
  let body = reply.body;
  if (proposedSlots.length) {
    body += "\n\nHere are a few times that work on my end:\n" + proposedSlots.map((s) => `• ${new Date(s).toLocaleString()}`).join("\n");
  }

  // 4. Financial / legal → never auto-send. Draft + escalate to the owner.
  if (classification.intent === "financial") {
    outcomes.push(await executeAction(ctx, {
      tool: "create_email_draft", runId, seq: seq++,
      input: { threadId: email.threadId, to: email.from, subject: reply.subject, body },
      reason: "Financial/legal email — prepared a draft for you.",
    }));
    outcomes.push(await executeAction(ctx, {
      tool: "notify_owner", runId, seq: seq++,
      input: { title: "A financial/legal email needs you", body: `${classification.personName || email.from}: ${classification.summary}` },
      reason: "Escalated a sensitive email.",
    }));
  } else {
    // 5. Reply — the policy engine decides auto-send vs. approval based on intent.
    outcomes.push(await executeAction(ctx, {
      tool: "send_email", runId, seq: seq++,
      input: { threadId: email.threadId, to: email.from, subject: reply.subject, body },
      category: intentToActionCategory(classification.intent),
      confidence: classification.confidence,
      recipientCount: 1,
      reason: injectionDetected
        ? "Replying to a customer inquiry. (Note: this email contained suspicious instructions, which were ignored.)"
        : classification.reasonSummary || "Replying to a customer inquiry.",
      title: `Reply to ${classification.personName || email.from}`,
    }));
  }

  // 6. Follow-up for leads.
  if (leadId && classification.intent !== "complaint" && classification.intent !== "financial") {
    outcomes.push(await executeAction(ctx, {
      tool: "create_followup", runId, seq: seq++,
      input: { leadId, inDays: 3, reason: "Inbound inquiry — follow up if no reply.", message: "" },
      reason: "Scheduled a follow-up so this lead doesn't go cold.",
    }));
  }

  // Complaint → also notify the owner.
  if (classification.intent === "complaint") {
    outcomes.push(await executeAction(ctx, {
      tool: "notify_owner", runId, seq: seq++,
      input: { title: "Possible complaint needs attention", body: `${classification.personName || email.from}: ${classification.summary}` },
      reason: "Flagged a possible complaint.",
    }));
  }

  if (seq > MAX_ACTIONS + 2) {
    // Defensive: we never plan more than a handful of actions per email.
  }

  // VERIFY + REMEMBER -------------------------------------------------------
  const done = outcomes.filter((o) => o.status === "done").length;
  const approvals = outcomes.filter((o) => o.status === "approval").length;

  await db.memory.create({
    data: {
      workspaceId: ctx.workspace.id, layer: "relationship",
      subjectType: leadId ? "lead" : "person", subjectId: leadId ?? email.from,
      content: `${classification.personName || email.from} emailed about "${email.subject}" (${classification.intent}). ${classification.summary}`,
      importance: classification.urgency === "high" ? 3 : 1,
    },
  });

  // Detect promises in both directions: what the customer said they'd do
  // ("I'll confirm Friday") and what we committed to in our reply. Best-effort
  // and deterministic — it never blocks or fails the loop.
  try {
    const party = classification.personName || email.fromName || email.from;
    await recordCommitments(ctx, {
      text: email.body || email.subject || "",
      authorIsUs: false, party,
      subjectType: leadId ? "lead" : "person", subjectId: leadId ?? email.from,
      sourceRef: `gmail:${email.messageId}`,
    });
    await recordCommitments(ctx, {
      text: body, authorIsUs: true, party,
      subjectType: leadId ? "lead" : "person", subjectId: leadId ?? email.from,
      sourceRef: `gmail:${email.messageId}`,
    });
  } catch {
    /* commitment detection is best-effort */
  }

  // REPORT ------------------------------------------------------------------
  const status = approvals > 0 ? "needs_approval" : "completed";
  const message = buildMessage(classification.intent, classification.personName || email.fromName || email.from, approvals);
  await finishRun(ctx, runId, { intent: classification.intent, summary: classification.summary, message, planned: seq, done, approvals, offline, status });
  return { runId, status, summary: classification.summary, message, actionsDone: done, approvals, offline };
}

// --- Meeting-starting handler (meeting preparation) ------------------------

async function handleMeetingStarting(ctx: WorkspaceContext, runId: string, rawPayload: unknown): Promise<LoopResult> {
  const ev = calendarEventPayload.parse(rawPayload);
  const attendee = ev.attendees[0];
  let brief = `Meeting: ${ev.title} at ${new Date(ev.startsAt).toLocaleString()}.`;
  if (attendee) {
    const lead = await db.lead.findFirst({ where: { workspaceId: ctx.workspace.id, email: attendee, deletedAt: null } });
    if (lead) brief += ` With ${lead.name} (stage: ${lead.stage}${lead.estimatedValue ? `, ~${lead.estimatedValue}` : ""}).`;
    const mems = await db.memory.findMany({
      where: { workspaceId: ctx.workspace.id, subjectType: "lead", subjectId: lead?.id },
      orderBy: { createdAt: "desc" }, take: 3,
    });
    if (mems.length) brief += " Recent: " + mems.map((m) => m.content).join(" ");
  }
  const o = await executeAction(ctx, {
    tool: "notify_owner", runId, seq: 0,
    input: { title: `Meeting in ~1 hour: ${ev.title}`, body: brief },
    reason: "Prepared a briefing before your meeting.",
  });
  const done = o.status === "done" ? 1 : 0;
  await finishRun(ctx, runId, { intent: "meeting_prep", summary: brief, message: `Prepared your briefing for "${ev.title}".`, planned: 1, done, approvals: 0, offline: true });
  return { runId, status: "completed", summary: brief, message: `Prepared your briefing for "${ev.title}".`, actionsDone: done, approvals: 0, offline: true };
}

// --- helpers ---------------------------------------------------------------

function buildMessage(intent: string, who: string, approvals: number): string {
  const base: Record<string, string> = {
    sales_inquiry: `New sales inquiry from ${who}`,
    complaint: `Possible complaint from ${who}`,
    support_question: `${who} asked a support question`,
    scheduling: `${who} wants to schedule a meeting`,
    financial: `Financial/legal email from ${who}`,
    existing_customer: `${who} got in touch`,
  };
  const line = base[intent] ?? `Handled an email from ${who}`;
  return approvals > 0 ? `${line} — 1 thing needs your approval.` : `${line} — handled.`;
}

async function linkMessageToLead(workspaceId: string, messageId: string, leadId: string, email: string, name: string) {
  await db.externalEntity.upsert({
    where: { workspaceId_provider_kind_externalId: { workspaceId, provider: "gmail", kind: "person", externalId: email } },
    create: { workspaceId, provider: "gmail", kind: "person", externalId: email, email, displayName: name || email, leadId },
    update: { leadId },
  });
  await db.externalEntity.updateMany({
    where: { workspaceId, provider: "gmail", kind: "message", externalId: messageId },
    data: { leadId },
  });
}

async function finishRun(
  ctx: WorkspaceContext, runId: string,
  r: { intent: string; summary: string; message: string; planned: number; done: number; approvals: number; offline: boolean; status?: string }
) {
  await db.automationRun.update({
    where: { id: runId },
    data: {
      status: r.status === "needs_approval" ? "needs_approval" : "completed",
      intent: r.intent, summary: r.summary, message: r.message,
      actionsPlanned: r.planned, actionsDone: r.done, approvalsCount: r.approvals,
      offline: r.offline, finishedAt: new Date(),
    },
  });
}
