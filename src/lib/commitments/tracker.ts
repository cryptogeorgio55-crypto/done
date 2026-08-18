import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/workspace/context";

/**
 * COMMITMENT TRACKER
 *
 * Detects promises in communication — both ones WE make ("I'll send the
 * proposal tomorrow") and ones others make to us ("I'll confirm Friday"). This
 * first pass is deterministic (pattern-based) so it runs with zero AI budget
 * and never hallucinates a promise that wasn't said; the reasoning model can
 * later refine due-dates. Detected commitments feed the Operations agent and
 * the twin, so nothing quietly slips.
 *
 * Honesty: pattern detection is imperfect, so every commitment carries a
 * confidence and a source reference, and "theirs" commitments are explicitly
 * NOT chased before their due date.
 */

const PROMISE_CUES = [
  /\bi(?:'ll| will)\b/i,
  /\bwe(?:'ll| will)\b/i,
  /\bi'?m going to\b/i,
  /\bi can (?:send|get|have|share)\b/i,
  /\blet me (?:send|get|share|check)\b/i,
];

const THEIRS_CUES = [
  /\bi(?:'ll| will) (?:confirm|let you know|get back|decide|check|pay|send)\b/i,
  /\bi'?m going to (?:confirm|decide|think)\b/i,
];

const DAYS: Record<string, number> = {
  today: 0, tonight: 0, tomorrow: 1,
  monday: -1, tuesday: -1, wednesday: -1, thursday: -1, friday: -1, saturday: -1, sunday: -1,
};

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** Best-effort due date from natural language. Returns null when unsure. */
export function inferDueAt(text: string, from = new Date()): Date | null {
  const lower = text.toLowerCase();
  for (const [word, offset] of Object.entries(DAYS)) {
    if (!new RegExp(`\\b${word}\\b`).test(lower)) continue;
    if (offset >= 0) {
      const d = new Date(from);
      d.setDate(d.getDate() + offset);
      d.setHours(18, 0, 0, 0);
      return d;
    }
    // A weekday name → next occurrence of that weekday.
    const target = WEEKDAY_INDEX[word];
    const d = new Date(from);
    let delta = (target - d.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    d.setHours(18, 0, 0, 0);
    return d;
  }
  if (/\bnext week\b/.test(lower)) {
    const d = new Date(from);
    d.setDate(d.getDate() + 7);
    return d;
  }
  return null;
}

export interface DetectedCommitment {
  direction: "ours" | "theirs";
  text: string;
  dueAt: Date | null;
  confidence: number;
}

/** Pure detector — split text into sentences and flag promise-bearing ones. */
export function detectCommitments(text: string, authorIsUs: boolean): DetectedCommitment[] {
  const sentences = text.split(/(?<=[.!?\n])\s+/).map((s) => s.trim()).filter(Boolean);
  const found: DetectedCommitment[] = [];
  for (const s of sentences) {
    if (s.length > 240) continue; // skip long non-committal prose
    const theirs = THEIRS_CUES.some((r) => r.test(s));
    const ours = PROMISE_CUES.some((r) => r.test(s));
    if (!theirs && !ours) continue;
    // Direction: an explicit "theirs" cue wins; otherwise use who authored it.
    const direction: "ours" | "theirs" = theirs && !authorIsUs ? "theirs" : authorIsUs ? "ours" : "theirs";
    found.push({
      direction,
      text: s.replace(/\s+/g, " ").slice(0, 200),
      dueAt: inferDueAt(s),
      confidence: theirs || ours ? 0.6 : 0.4,
    });
  }
  return found;
}

/**
 * Detect commitments in a message and persist any new ones for a workspace.
 * De-duplicates on (direction, party, text) so re-processing a thread is safe.
 */
export async function recordCommitments(
  ctx: WorkspaceContext,
  opts: {
    text: string;
    authorIsUs: boolean;
    party: string;
    subjectType?: string;
    subjectId?: string;
    sourceRef?: string;
  }
): Promise<number> {
  const detected = detectCommitments(opts.text, opts.authorIsUs);
  let created = 0;
  for (const c of detected) {
    const existing = await db.commitment.findFirst({
      where: {
        workspaceId: ctx.workspace.id,
        direction: c.direction,
        party: opts.party,
        text: c.text,
        status: { in: ["open", "overdue"] },
      },
    });
    if (existing) continue;
    await db.commitment.create({
      data: {
        workspaceId: ctx.workspace.id,
        direction: c.direction,
        party: opts.party,
        subjectType: opts.subjectType,
        subjectId: opts.subjectId,
        text: c.text,
        dueAt: c.dueAt,
        confidence: c.confidence,
        source: "detected",
        sourceRef: opts.sourceRef,
      },
    });
    created++;
  }
  return created;
}

/** Flip open commitments whose due date has passed to `overdue` (idempotent). */
export async function markOverdueCommitments(ctx: WorkspaceContext): Promise<number> {
  const res = await db.commitment.updateMany({
    where: { workspaceId: ctx.workspace.id, direction: "ours", status: "open", dueAt: { lt: new Date() } },
    data: { status: "overdue" },
  });
  return res.count;
}
