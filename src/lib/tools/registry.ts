import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { ActionCategory, ActionRisk } from "@/lib/autonomy/types";
import { invokeCapability } from "@/lib/connectors/accounts";
import { searchKnowledge } from "@/lib/knowledge/search";

// The AI TOOL SYSTEM.
//
// The model NEVER gets raw provider access. It may only request these explicit
// tools. Each tool declares its input schema, its default risk, its action
// category (for policy), and which integration it needs. Every invocation is
// validated and — via the executor — gated by the policy engine and logged.

export interface ToolResult {
  detail: string; // human-readable summary for the activity log
  output?: unknown; // structured result
  targetType?: string;
  targetId?: string;
  reversible?: boolean;
}

export interface Tool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  category: ActionCategory;
  risk: ActionRisk;
  /** Provider whose connection is required, if any. */
  requiresProvider?: string;
  inputSchema: S;
  /** Human-readable preview shown in the Approval Center before running. */
  preview(input: z.infer<S>): string;
  run(ctx: WorkspaceContext, input: z.infer<S>): Promise<ToolResult>;
}

// ---- Email ----------------------------------------------------------------

const searchEmail: Tool = {
  name: "search_email",
  description: "Search the connected inbox for messages matching a query.",
  category: "internal_task",
  risk: "low",
  requiresProvider: "gmail",
  inputSchema: z.object({ query: z.string().max(200).default("") }),
  preview: (i) => `Search inbox for "${i.query}"`,
  async run(ctx, i) {
    const out = await invokeCapability(ctx, "gmail", "gmail.search_messages", i);
    const n = (out as { messages?: unknown[] }).messages?.length ?? 0;
    return { detail: `Searched inbox for "${i.query}" (${n} results)`, output: out };
  },
};

const readEmailThread: Tool = {
  name: "read_email_thread",
  description: "Read the full message history of an email thread.",
  category: "internal_task",
  risk: "low",
  requiresProvider: "gmail",
  inputSchema: z.object({ threadId: z.string() }),
  preview: (i) => `Read email thread ${i.threadId}`,
  async run(ctx, i) {
    const out = await invokeCapability(ctx, "gmail", "gmail.read_thread", i);
    return { detail: `Read thread ${i.threadId}`, output: out };
  },
};

const emailBody = z.object({
  threadId: z.string().optional(),
  to: z.string().email(),
  subject: z.string().max(300),
  body: z.string().max(8000),
});

const createEmailDraft: Tool = {
  name: "create_email_draft",
  description: "Create a draft reply the owner can review and send.",
  category: "internal_task", // drafting never sends, so it's low-risk
  risk: "low",
  requiresProvider: "gmail",
  inputSchema: emailBody,
  preview: (i) => `Draft email to ${i.to} — "${i.subject}"`,
  async run(ctx, i) {
    const out = await invokeCapability(ctx, "gmail", "gmail.create_draft", i);
    return { detail: `Drafted reply to ${i.to}`, output: out, targetType: "email_draft" };
  },
};

const sendEmail: Tool = {
  name: "send_email",
  description: "Send an email reply to a customer.",
  category: "customer_reply",
  risk: "medium",
  requiresProvider: "gmail",
  inputSchema: emailBody,
  preview: (i) => `Send email to ${i.to} — "${i.subject}"`,
  async run(ctx, i) {
    const out = await invokeCapability(ctx, "gmail", "gmail.send_message", i);
    return { detail: `Sent reply to ${i.to}`, output: out, targetType: "email" };
  },
};

// ---- Calendar -------------------------------------------------------------

const checkAvailability: Tool = {
  name: "check_availability",
  description: "Find free meeting slots on the calendar.",
  category: "internal_task",
  risk: "low",
  requiresProvider: "google_calendar",
  inputSchema: z.object({ date: z.string().optional(), durationMins: z.number().int().min(15).max(240).default(30) }),
  preview: (i) => `Check availability${i.date ? ` on ${i.date}` : ""}`,
  async run(ctx, i) {
    const out = await invokeCapability(ctx, "google_calendar", "calendar.check_availability", i);
    return { detail: "Checked calendar availability", output: out };
  },
};

const createEvent: Tool = {
  name: "create_calendar_event",
  description: "Create a calendar event / meeting.",
  category: "schedule_meeting",
  risk: "medium",
  requiresProvider: "google_calendar",
  inputSchema: z.object({
    title: z.string().max(200),
    startsAt: z.string(),
    durationMins: z.number().int().min(15).max(480).default(30),
    attendees: z.array(z.string()).max(20).default([]),
    location: z.string().max(200).default(""),
    notes: z.string().max(2000).default(""),
  }),
  preview: (i) => `Create event "${i.title}" at ${new Date(i.startsAt).toLocaleString()}`,
  async run(ctx, i) {
    const out = await invokeCapability(ctx, "google_calendar", "calendar.create_event", i);
    const eventId = (out as { eventId?: string }).eventId;
    return { detail: `Scheduled "${i.title}"`, output: out, targetType: "calendar_event", targetId: eventId };
  },
};

// ---- Leads / CRM (internal) ----------------------------------------------

const createLead: Tool = {
  name: "create_lead",
  description: "Create a new lead in the CRM.",
  category: "create_lead",
  risk: "low",
  inputSchema: z.object({
    name: z.string().max(160),
    email: z.string().email().optional(),
    source: z.string().max(60).default("email"),
    notes: z.string().max(2000).default(""),
    estimatedValue: z.string().max(60).optional(),
  }),
  preview: (i) => `Create lead "${i.name}"`,
  async run(ctx, i) {
    // De-dupe by email within the workspace.
    if (i.email) {
      const existing = await db.lead.findFirst({
        where: { workspaceId: ctx.workspace.id, email: i.email, deletedAt: null },
      });
      if (existing) {
        return { detail: `Lead already exists for ${i.email}`, output: { leadId: existing.id, existed: true }, targetType: "lead", targetId: existing.id };
      }
    }
    const lead = await db.lead.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: i.name,
        email: i.email ?? null,
        source: i.source,
        notes: i.notes || null,
        estimatedValue: i.estimatedValue ?? null,
        stage: "new",
        lastContactAt: new Date(),
      },
    });
    return { detail: `Created lead "${i.name}"`, output: { leadId: lead.id }, targetType: "lead", targetId: lead.id, reversible: true };
  },
};

const updateLead: Tool = {
  name: "update_lead",
  description: "Update a lead's stage, notes, or follow-up date.",
  category: "update_lead",
  risk: "low",
  inputSchema: z.object({
    leadId: z.string(),
    stage: z.enum(["new", "contacted", "interested", "followup", "won", "lost"]).optional(),
    note: z.string().max(2000).optional(),
    nextFollowUpAt: z.string().optional(),
  }),
  preview: (i) => `Update lead ${i.leadId}${i.stage ? ` → ${i.stage}` : ""}`,
  async run(ctx, i) {
    const lead = await db.lead.findFirst({ where: { id: i.leadId, workspaceId: ctx.workspace.id } });
    if (!lead) throw new AppError("not_found", "Lead not found.", 404);
    await db.lead.update({
      where: { id: lead.id },
      data: {
        ...(i.stage ? { stage: i.stage } : {}),
        ...(i.nextFollowUpAt ? { nextFollowUpAt: new Date(i.nextFollowUpAt) } : {}),
        lastContactAt: new Date(),
      },
    });
    if (i.note) await db.leadNote.create({ data: { leadId: lead.id, body: i.note } });
    return { detail: `Updated lead "${lead.name}"`, output: { leadId: lead.id }, targetType: "lead", targetId: lead.id };
  },
};

const createFollowup: Tool = {
  name: "create_followup",
  description: "Schedule a future follow-up for a lead.",
  category: "internal_task",
  risk: "low",
  inputSchema: z.object({
    leadId: z.string(),
    inDays: z.number().int().min(1).max(90).default(3),
    reason: z.string().max(400).default(""),
    message: z.string().max(3000).default(""),
  }),
  preview: (i) => `Schedule follow-up in ${i.inDays} day(s)`,
  async run(ctx, i) {
    const lead = await db.lead.findFirst({ where: { id: i.leadId, workspaceId: ctx.workspace.id } });
    if (!lead) throw new AppError("not_found", "Lead not found.", 404);
    const due = new Date(Date.now() + i.inDays * 24 * 3600_000);
    await db.lead.update({ where: { id: lead.id }, data: { nextFollowUpAt: due, stage: lead.stage === "new" ? "contacted" : lead.stage } });
    await db.memory.create({
      data: {
        workspaceId: ctx.workspace.id,
        layer: "operational",
        subjectType: "lead",
        subjectId: lead.id,
        content: `Follow up ${lead.name} on ${due.toDateString()}. ${i.reason}`.trim(),
        metadata: { message: i.message } as unknown as object,
        importance: 2,
      },
    });
    return { detail: `Follow-up for "${lead.name}" set for ${due.toDateString()}`, output: { leadId: lead.id, dueAt: due.toISOString() }, targetType: "lead", targetId: lead.id };
  },
};

const searchKnowledgeTool: Tool = {
  name: "search_knowledge",
  description: "Search the business's connected knowledge (policies, pricing, FAQs).",
  category: "internal_task",
  risk: "low",
  inputSchema: z.object({ query: z.string().max(200) }),
  preview: (i) => `Search knowledge for "${i.query}"`,
  async run(ctx, i) {
    const results = await searchKnowledge(ctx.workspace.id, i.query);
    return { detail: `Searched knowledge for "${i.query}"`, output: { results } };
  },
};

const notifyOwner: Tool = {
  name: "notify_owner",
  description: "Send the business owner an in-app notification.",
  category: "internal_task",
  risk: "low",
  inputSchema: z.object({ title: z.string().max(160), body: z.string().max(1000).default("") }),
  preview: (i) => `Notify owner: ${i.title}`,
  async run(ctx, i) {
    await db.notification.create({
      data: { workspaceId: ctx.workspace.id, userId: ctx.user.id, kind: "autopilot", title: i.title, body: i.body || null },
    });
    return { detail: `Notified owner: ${i.title}` };
  },
};

export const TOOLS: Record<string, Tool> = {
  [searchEmail.name]: searchEmail,
  [readEmailThread.name]: readEmailThread,
  [createEmailDraft.name]: createEmailDraft,
  [sendEmail.name]: sendEmail,
  [checkAvailability.name]: checkAvailability,
  [createEvent.name]: createEvent,
  [createLead.name]: createLead,
  [updateLead.name]: updateLead,
  [createFollowup.name]: createFollowup,
  [searchKnowledgeTool.name]: searchKnowledgeTool,
  [notifyOwner.name]: notifyOwner,
};

export function getTool(name: string): Tool | null {
  return TOOLS[name] ?? null;
}

/** Compact tool catalog for the planner prompt. */
export function toolCatalogForPrompt(): string {
  return Object.values(TOOLS)
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");
}
