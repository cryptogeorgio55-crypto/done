import { z } from "zod";

// Normalized events are the lingua franca of the DONE Loop. Integrations
// translate their provider-specific webhooks/polls into these shapes; the
// orchestrator only ever sees normalized events.

export const EVENT_TYPES = [
  "email.received",
  "email.sent",
  "lead.created",
  "lead.stage_changed",
  "lead.followup_due",
  "calendar.event_created",
  "calendar.event_starting",
  "payment.failed",
  "order.created",
  "content.schedule_due",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_CATEGORIES = [
  "needs_attention",
  "sales",
  "customers",
  "operations",
  "finance",
  "meetings",
  "marketing",
  "done_auto",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/**
 * A normalized event awaiting ingestion. `payload` carries external content and
 * is treated as UNTRUSTED throughout the pipeline — it is never interpreted as
 * instructions to the model.
 */
export interface NormalizedEvent {
  type: EventType;
  source: string; // gmail | google_calendar | internal | ...
  /** Stable id from the provider (or synthesized) used for dedupe per workspace. */
  dedupeKey: string;
  title?: string;
  summary?: string;
  occurredAt?: Date;
  /** External entity id (person/thread) if resolvable at ingestion time. */
  entityId?: string;
  payload: Record<string, unknown>;
}

/** Payload for an inbound email event. */
export const emailReceivedPayload = z.object({
  messageId: z.string(),
  threadId: z.string(),
  from: z.string(),
  fromName: z.string().optional().default(""),
  to: z.string().optional().default(""),
  subject: z.string().optional().default(""),
  snippet: z.string().optional().default(""),
  body: z.string().optional().default(""),
  receivedAt: z.string().optional(),
});
export type EmailReceivedPayload = z.infer<typeof emailReceivedPayload>;

export const calendarEventPayload = z.object({
  eventId: z.string(),
  title: z.string().optional().default(""),
  startsAt: z.string(),
  endsAt: z.string().optional().default(""),
  attendees: z.array(z.string()).optional().default([]),
  location: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});
export type CalendarEventPayload = z.infer<typeof calendarEventPayload>;
