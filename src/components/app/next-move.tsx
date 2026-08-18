"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { IconArrow } from "@/components/icons";

/** Mirror of NextMove from the engine (kept structural to avoid a server import). */
export interface NextMoveDTO {
  id: string;
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  summary: string;
  reason: string;
  recommendedAction: string;
  expectedImpact: "high" | "medium" | "low";
  risk: "low" | "medium" | "high";
  requiresApproval: boolean;
  entities: { type: string; id: string; label: string }[];
  toolsRequired: string[];
}

/** Where "Execute" takes the owner to complete each kind of move. Honest routing —
 * we progress the real work rather than play a fake execution animation. */
const EXECUTE_TARGET: Record<string, string> = {
  approval: "/approvals",
  sales_followup: "/leads",
  lead_reactivation: "/campaigns",
  meeting_brief: "/autopilot",
  needs_attention: "/inbox",
  content_gap: "/content",
};

const IMPACT_TONE: Record<string, string> = {
  high: "text-emerald-600",
  medium: "text-brand",
  low: "text-muted",
};
const RISK_TONE: Record<string, string> = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-red-600",
};

export function NextMoveBoard({ initial }: { initial: NextMoveDTO[] }) {
  const router = useRouter();
  const [moves, setMoves] = useState<NextMoveDTO[]>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api<{ moves: NextMoveDTO[] }>("/api/next-move");
      setMoves(data.moves);
    } catch {
      /* keep current moves on failure */
    } finally {
      setRefreshing(false);
    }
  }, []);

  const execute = useCallback(
    (m: NextMoveDTO) => {
      setExecuting(m.id);
      const dest = EXECUTE_TARGET[m.type] ?? "/dashboard";
      const entity = m.entities[0]?.id;
      // Small press beat, then route to where the action is completed.
      setTimeout(() => {
        router.push(entity ? `${dest}?focus=${encodeURIComponent(entity)}` : dest);
      }, 160);
    },
    [router]
  );

  if (moves.length === 0) {
    return (
      <section className="card p-6 animate-slide-up">
        <p className="eyebrow">Next Move</p>
        <h2 className="h-hero mt-2">You&apos;re all caught up.</h2>
        <p className="mt-2 max-w-lg text-ink-soft">
          Nothing needs a decision right now. As soon as a lead replies, a meeting approaches, or
          something needs you, it&apos;ll show up here.
        </p>
      </section>
    );
  }

  const [hero, ...rest] = moves;

  return (
    <section className="space-y-4">
      {/* ---- Hero: the single most valuable move right now ---- */}
      <MoveHero move={hero} onExecute={() => execute(hero)} executing={executing === hero.id} />

      {/* ---- Secondary ranked moves ---- */}
      {rest.length > 0 ? (
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {rest.map((m, i) => (
            <MoveCard
              key={m.id}
              move={m}
              index={i + 2}
              onExecute={() => execute(m)}
              executing={executing === m.id}
              style={{ ["--i" as string]: i }}
            />
          ))}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          {refreshing ? "Re-reading the business…" : "Recalculate"}
        </button>
      </div>
    </section>
  );
}

function PriorityDot({ priority }: { priority: NextMoveDTO["priority"] }) {
  const tone = priority === "high" ? "bg-red-500" : priority === "medium" ? "bg-amber-500" : "bg-muted";
  return <span className={`inline-block h-2 w-2 rounded-full ${tone}`} aria-hidden />;
}

function ImpactRisk({ move }: { move: NextMoveDTO }) {
  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="text-muted">Impact</span>
        <span className={`font-semibold capitalize ${IMPACT_TONE[move.expectedImpact]}`}>{move.expectedImpact}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-muted">Risk</span>
        <span className={`font-semibold capitalize ${RISK_TONE[move.risk]}`}>{move.risk}</span>
      </span>
      {move.requiresApproval ? <span className="text-muted">· Needs your approval</span> : null}
    </div>
  );
}

function MoveHero({ move, onExecute, executing }: { move: NextMoveDTO; onExecute: () => void; executing: boolean }) {
  const [showWhy, setShowWhy] = useState(false);
  return (
    <div className="card relative overflow-hidden p-7 animate-slide-up">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: "var(--grad-brand)" }}
        aria-hidden
      />
      <div className="flex items-center gap-2">
        <p className="eyebrow">Next Move</p>
        <PriorityDot priority={move.priority} />
      </div>
      <h2 className="h-hero mt-2 max-w-2xl">{move.title}</h2>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">{move.summary}</p>

      <div className="mt-4">
        <ImpactRisk move={move} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onExecute}
          className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[15px] font-semibold text-white shadow-[var(--shadow-glow)] transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.97] ${executing ? "lazy-pressing" : ""}`}
          style={{ background: "var(--grad-brand)" }}
        >
          {executing ? "Opening…" : "Execute"} <IconArrow className="h-4 w-4" />
        </button>
        <button
          onClick={() => setShowWhy((v) => !v)}
          className="text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          aria-expanded={showWhy}
        >
          Why this?
        </button>
      </div>

      {showWhy ? (
        <div className="mt-4 max-w-2xl rounded-xl border border-line bg-surface/60 p-4 animate-slide-up">
          <p className="text-sm text-ink-soft">{move.reason}</p>
          <p className="mt-2 text-sm text-ink">
            <span className="font-medium">Recommended:</span> {move.recommendedAction}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function MoveCard({
  move, index, onExecute, executing, style,
}: {
  move: NextMoveDTO; index: number; onExecute: () => void; executing: boolean; style?: React.CSSProperties;
}) {
  return (
    <div className="card card-hover flex flex-col p-5" style={style}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold tabular-nums text-muted">{String(index).padStart(2, "0")}</span>
        <PriorityDot priority={move.priority} />
      </div>
      <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">{move.title}</p>
      <p className="mt-1 line-clamp-2 flex-1 text-sm text-ink-soft">{move.summary}</p>
      <div className="mt-3">
        <ImpactRisk move={move} />
      </div>
      <button
        onClick={onExecute}
        className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand ${executing ? "lazy-pressing" : ""}`}
      >
        {executing ? "Opening…" : "Execute"} <IconArrow className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
