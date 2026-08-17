import { z } from "zod";
import { randomUUID } from "crypto";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import type { Capability, CapabilityCallContext, Connector } from "./types";
import type { NormalizedEvent } from "@/lib/events/types";
import { getValidGoogleAccessToken } from "./google-oauth";

const availabilityInput = z.object({
  // ISO date (YYYY-MM-DD). Availability is computed against existing events.
  date: z.string().optional(),
  durationMins: z.number().int().min(15).max(240).default(30),
});
const createInput = z.object({
  title: z.string().max(200),
  startsAt: z.string(), // ISO
  durationMins: z.number().int().min(15).max(480).default(30),
  attendees: z.array(z.string()).max(20).default([]),
  location: z.string().max(200).default(""),
  notes: z.string().max(2000).default(""),
});

interface EventData {
  title: string;
  startsAt: string;
  endsAt: string;
  attendees: string[];
  location: string;
  notes: string;
}

export const calendarConnector: Connector = {
  key: "google_calendar",
  name: "Google Calendar",
  category: "calendar",
  phase: 1,
  description: "Understand your availability, propose times, and create events.",
  permissions: ["Read your events", "Check availability", "Create and update events (only when allowed)"],
  capabilities: [
    "calendar.read_events",
    "calendar.check_availability",
    "calendar.create_event",
    "calendar.update_event",
  ],
  implemented: true,
  oauth: true,

  async poll(cc): Promise<NormalizedEvent[]> {
    // Emit calendar.event_starting for events beginning within the next 75 min.
    const wsId = cc.ctx.workspace.id;
    // In oauth mode, pull the live calendar into our local mirror first.
    if (cc.config.mode === "oauth") await syncCalendarApi(cc.accountId, wsId);
    const soon = Date.now() + 75 * 60_000;
    const rows = await db.externalEntity.findMany({
      where: { workspaceId: wsId, provider: "google_calendar", kind: "event" },
    });
    const events: NormalizedEvent[] = [];
    for (const r of rows) {
      const data = r.data as unknown as EventData;
      const start = new Date(data.startsAt).getTime();
      if (start > Date.now() && start <= soon) {
        events.push({
          type: "calendar.event_starting",
          source: "google_calendar",
          dedupeKey: `calendar:starting:${r.externalId}:${new Date(start).toISOString().slice(0, 13)}`,
          title: `Upcoming: ${data.title}`,
          summary: `${data.title} at ${new Date(start).toLocaleTimeString()}`,
          occurredAt: new Date(),
          entityId: r.externalId,
          payload: { eventId: r.externalId, title: data.title, startsAt: data.startsAt, attendees: data.attendees },
        });
      }
    }
    return events;
  },

  async health(cc) {
    if (cc.config.mode === "oauth") {
      const token = await getValidGoogleAccessToken(cc.accountId).catch(() => null);
      return token ? { status: "ok" as const } : { status: "down" as const, detail: "Reconnect required." };
    }
    return { status: "ok" as const, detail: "Sandbox mode." };
  },

  async invoke(cc, capability: Capability, rawInput: unknown): Promise<unknown> {
    const wsId = cc.ctx.workspace.id;
    switch (capability) {
      case "calendar.read_events": {
        const rows = await db.externalEntity.findMany({
          where: { workspaceId: wsId, provider: "google_calendar", kind: "event" },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        return {
          events: rows.map((r) => ({ eventId: r.externalId, ...(r.data as unknown as EventData) })),
        };
      }
      case "calendar.check_availability": {
        const { date, durationMins } = availabilityInput.parse(rawInput);
        return computeAvailability(wsId, date, durationMins);
      }
      case "calendar.create_event": {
        const input = createInput.parse(rawInput);
        const start = new Date(input.startsAt);
        if (Number.isNaN(start.getTime())) throw new AppError("bad_input", "Invalid start time.", 422);
        const end = new Date(start.getTime() + input.durationMins * 60_000);
        const data: EventData = {
          title: input.title,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          attendees: input.attendees,
          location: input.location,
          notes: input.notes,
        };
        // In oauth mode, create the event on Google and mirror it locally.
        const eventId =
          cc.config.mode === "oauth"
            ? await createEventApi(cc.accountId, data)
            : `evt-${randomUUID().slice(0, 8)}`;
        await db.externalEntity.create({
          data: {
            workspaceId: wsId,
            provider: "google_calendar",
            kind: "event",
            externalId: eventId,
            displayName: input.title,
            data: data as unknown as object,
          },
        });
        return { eventId, ...data };
      }
      case "calendar.update_event": {
        const schema = createInput.partial().extend({ eventId: z.string() });
        const input = schema.parse(rawInput);
        const row = await db.externalEntity.findUnique({
          where: {
            workspaceId_provider_kind_externalId: {
              workspaceId: wsId,
              provider: "google_calendar",
              kind: "event",
              externalId: input.eventId,
            },
          },
        });
        if (!row) throw new AppError("not_found", "Event not found.", 404);
        const prev = row.data as unknown as EventData;
        const merged: EventData = {
          ...prev,
          ...(input.title ? { title: input.title } : {}),
          ...(input.startsAt ? { startsAt: new Date(input.startsAt).toISOString() } : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        };
        if (cc.config.mode === "oauth") await updateEventApi(cc.accountId, input.eventId, merged);
        await db.externalEntity.update({ where: { id: row.id }, data: { data: merged as unknown as object } });
        return { eventId: input.eventId, ...merged };
      }
      default:
        throw new AppError("capability_unsupported", `Calendar cannot ${capability}.`, 400);
    }
  },
};

// --------------------------------------------------------------------------
// Real Google Calendar REST API (oauth mode).
// Docs: developers.google.com/calendar/api/v3/reference
// --------------------------------------------------------------------------

const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

interface GCalTime { dateTime?: string; date?: string }
interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GCalTime;
  end?: GCalTime;
  attendees?: { email: string }[];
}

function gcalTime(t: GCalTime | undefined): string {
  return (t?.dateTime || t?.date || "") as string;
}

function toEventData(e: GCalEvent): EventData {
  return {
    title: e.summary || "(no title)",
    startsAt: new Date(gcalTime(e.start)).toISOString(),
    endsAt: new Date(gcalTime(e.end) || gcalTime(e.start)).toISOString(),
    attendees: (e.attendees ?? []).map((a) => a.email),
    location: e.location ?? "",
    notes: e.description ?? "",
  };
}

async function calToken(accountId: string) {
  return getValidGoogleAccessToken(accountId);
}

/** Pull upcoming events from Google into the local ExternalEntity mirror. */
async function syncCalendarApi(accountId: string, workspaceId: string): Promise<void> {
  const token = await calToken(accountId);
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 14 * 24 * 3600_000).toISOString();
  const url = `${CAL_BASE}?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new AppError("calendar_api_error", `Calendar request failed (${res.status}).`, 502);
  const json = (await res.json()) as { items?: GCalEvent[] };
  for (const e of json.items ?? []) {
    if (!gcalTime(e.start)) continue;
    const data = toEventData(e);
    await db.externalEntity.upsert({
      where: {
        workspaceId_provider_kind_externalId: {
          workspaceId, provider: "google_calendar", kind: "event", externalId: e.id,
        },
      },
      create: {
        workspaceId, provider: "google_calendar", kind: "event", externalId: e.id,
        displayName: data.title, data: data as unknown as object,
      },
      update: { displayName: data.title, data: data as unknown as object },
    });
  }
}

async function createEventApi(accountId: string, data: EventData): Promise<string> {
  const token = await calToken(accountId);
  const res = await fetch(CAL_BASE, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      summary: data.title,
      description: data.notes,
      location: data.location,
      start: { dateTime: data.startsAt },
      end: { dateTime: data.endsAt },
      attendees: data.attendees.map((email) => ({ email })),
    }),
  });
  if (!res.ok) throw new AppError("calendar_api_error", `Calendar create failed (${res.status}).`, 502);
  const json = (await res.json()) as { id: string };
  return json.id;
}

async function updateEventApi(accountId: string, eventId: string, data: EventData): Promise<void> {
  const token = await calToken(accountId);
  const res = await fetch(`${CAL_BASE}/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      summary: data.title,
      description: data.notes,
      location: data.location,
      start: { dateTime: data.startsAt },
      end: { dateTime: data.endsAt },
    }),
  });
  if (!res.ok) throw new AppError("calendar_api_error", `Calendar update failed (${res.status}).`, 502);
}

/** Return free 30-min slots between 9:00–17:00 for a date, minus busy events. */
async function computeAvailability(workspaceId: string, dateStr: string | undefined, durationMins: number) {
  const base = dateStr ? new Date(dateStr + "T00:00:00") : new Date(Date.now() + 24 * 3600_000);
  if (Number.isNaN(base.getTime())) throw new AppError("bad_input", "Invalid date.", 422);
  const day = new Date(base.getFullYear(), base.getMonth(), base.getDate());

  const rows = await db.externalEntity.findMany({
    where: { workspaceId, provider: "google_calendar", kind: "event" },
  });
  const busy = rows
    .map((r) => r.data as unknown as EventData)
    .map((d) => ({ start: new Date(d.startsAt).getTime(), end: new Date(d.endsAt).getTime() }))
    .filter((b) => new Date(b.start).toDateString() === day.toDateString());

  const slots: string[] = [];
  for (let h = 9; h < 17; h++) {
    for (const min of [0, 30]) {
      const slotStart = new Date(day); slotStart.setHours(h, min, 0, 0);
      const slotEnd = slotStart.getTime() + durationMins * 60_000;
      if (slotStart.getTime() < Date.now()) continue;
      const clash = busy.some((b) => slotStart.getTime() < b.end && slotEnd > b.start);
      if (!clash) slots.push(slotStart.toISOString());
      if (slots.length >= 6) break;
    }
    if (slots.length >= 6) break;
  }
  return { date: day.toISOString().slice(0, 10), durationMins, freeSlots: slots };
}
