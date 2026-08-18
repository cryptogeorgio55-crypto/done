"use client";

import { useState } from "react";
import { api, ClientApiError } from "@/lib/client";

interface Alternative {
  label: string;
  impact: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
  note?: string | null;
}
interface Decision {
  decision: string;
  confidence: "low" | "medium" | "high";
  why: string;
  betterMove?: string | null;
  alternatives: Alternative[];
  risks: string[];
  nextAction: string;
  needsInfo: string[];
}

const EXAMPLES = [
  "Should I give this customer a discount?",
  "Which leads should we focus on this week?",
  "Should we launch a weekend campaign?",
  "Is it worth reactivating my old leads?",
];

const TONE: Record<string, string> = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-red-600",
};

export function DecisionRoomClient() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ decision: Decision; offline: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze(q: string) {
    const query = q.trim();
    if (query.length < 6 || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api<{ decision: Decision; offline: boolean }>("/api/decision-room", {
        method: "POST",
        body: { question: query },
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          analyze(question);
        }}
        className="card p-5"
      >
        <label htmlFor="decision" className="eyebrow">
          Bring me a business decision
        </label>
        <textarea
          id="decision"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder="Should I give this customer a discount?"
          className="mt-2 w-full resize-none rounded-xl border border-line bg-canvas p-3.5 text-[15px] text-ink outline-none transition-shadow focus:border-brand focus:shadow-[0_0_0_3px_rgba(0,147,146,0.12)]"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuestion(ex);
                  analyze(ex);
                }}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                {ex}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || question.trim().length < 6}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-50"
            style={{ background: "var(--grad-brand)" }}
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </form>

      {error ? <div className="card border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {loading ? <DecisionSkeleton /> : null}

      {result ? <DecisionView decision={result.decision} offline={result.offline} /> : null}
    </div>
  );
}

function DecisionSkeleton() {
  return (
    <div className="card space-y-4 p-6">
      <div className="skeleton h-7 w-2/3" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-5/6" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
      </div>
    </div>
  );
}

function DecisionView({ decision, offline }: { decision: Decision; offline: boolean }) {
  return (
    <div className="card overflow-hidden animate-slide-up-lg">
      <div className="h-1 w-full" style={{ background: "var(--grad-brand)" }} aria-hidden />
      <div className="space-y-6 p-6">
        <div>
          <div className="flex items-center gap-2">
            <p className="eyebrow">Recommendation</p>
            <span className={`text-xs font-semibold capitalize ${TONE[decision.confidence]}`}>
              {decision.confidence} confidence
            </span>
            {offline ? <span className="chip chip-scheduled">offline mode</span> : null}
          </div>
          <h2 className="h-hero mt-2">{decision.decision}</h2>
          <p className="mt-3 max-w-2xl text-ink-soft">{decision.why}</p>
        </div>

        {decision.needsInfo.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">Needs information</p>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-amber-800">
              {decision.needsInfo.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {decision.betterMove ? (
          <div>
            <p className="eyebrow mb-1.5">Better move</p>
            <p className="text-[15px] text-ink">{decision.betterMove}</p>
          </div>
        ) : null}

        {decision.alternatives.length > 0 ? (
          <div>
            <p className="eyebrow mb-2">Alternatives</p>
            <div className="stagger grid gap-3 sm:grid-cols-3">
              {decision.alternatives.map((a, i) => (
                <div key={i} className="rounded-xl border border-line p-4" style={{ ["--i" as string]: i }}>
                  <p className="text-[15px] font-medium text-ink">{a.label}</p>
                  {a.note ? <p className="mt-1 text-sm text-ink-soft">{a.note}</p> : null}
                  <dl className="mt-3 space-y-1 text-xs">
                    <MetricRow label="Impact" value={a.impact} />
                    <MetricRow label="Effort" value={a.effort} />
                    <MetricRow label="Risk" value={a.risk} tone />
                  </dl>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {decision.risks.length > 0 ? (
          <div>
            <p className="eyebrow mb-1.5">Risks</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-ink-soft">
              {decision.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-xl bg-surface p-4">
          <p className="eyebrow mb-1">Next action</p>
          <p className="text-[15px] font-medium text-ink">{decision.nextAction}</p>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={`font-semibold capitalize ${tone ? TONE[value] : "text-ink"}`}>{value}</dd>
    </div>
  );
}
