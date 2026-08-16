"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ClientApiError } from "@/lib/client";
import { BoltIcon, ArrowIcon } from "@/components/brand";

interface LazyResult {
  runId: string;
  message: string;
  resultKind: string;
  campaignId?: string;
  contentId?: string;
  offline: boolean;
}

type Phase = "idle" | "working" | "done" | "error";

export function LazyButton() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pressing, setPressing] = useState(false);
  const [result, setResult] = useState<LazyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (phase === "working") return;
    setPressing(true);
    setTimeout(() => setPressing(false), 340);
    setPhase("working");
    setError(null);
    // Idempotency key so an accidental double-press won't create duplicate work.
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    try {
      const data = await api<LazyResult>("/api/lazy", {
        method: "POST",
        body: { idempotencyKey },
      });
      setResult(data);
      setPhase("done");
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Try again.");
      setPhase("error");
    }
  }

  const targetHref =
    result?.resultKind === "campaign"
      ? "/campaigns"
      : result?.resultKind === "content"
        ? "/content"
        : result?.resultKind === "followup"
          ? "/leads"
          : "/dashboard";

  return (
    <div>
      <p className="mb-2 text-center text-xs font-semibold tracking-widest text-white/80">JUST PRESS</p>
      <button
        onClick={run}
        disabled={phase === "working"}
        aria-live="polite"
        className={`card flex w-full items-center justify-between gap-3 bg-gradient-to-br from-brand to-cyan px-6 py-5 text-white transition-transform hover:brightness-105 disabled:opacity-90 ${
          pressing ? "lazy-pressing" : ""
        }`}
      >
        <BoltIcon className="h-6 w-6 shrink-0" />
        <span className="text-2xl font-semibold tracking-tight">
          {phase === "working" ? "I've got you…" : "I'M LAZY"}
        </span>
        <ArrowIcon className="h-6 w-6 shrink-0" />
      </button>

      {phase === "done" && result ? (
        <div className="card mt-4 p-5">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-emerald-700">✓</span>
            <span className="font-semibold">DONE.</span>
            {result.offline ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">offline mode</span>
            ) : null}
          </div>
          <p className="mt-2 text-ink-soft">{result.message}</p>
          <div className="mt-4 flex gap-2">
            <a href={targetHref} className="inline-flex items-center gap-1 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
              Review it <ArrowIcon className="h-4 w-4" />
            </a>
            <button onClick={run} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-surface">
              Do something else
            </button>
          </div>
        </div>
      ) : null}

      {phase === "error" && error ? (
        <div className="card mt-4 border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}{" "}
          <button onClick={run} className="font-medium underline">Try again</button>
        </div>
      ) : null}
    </div>
  );
}
