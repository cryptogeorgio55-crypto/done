"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, ClientApiError } from "@/lib/client";
import { BoltIcon } from "@/components/brand";
import { IconArrow } from "@/components/icons";
import { DoneRun, type RunStep } from "@/components/app/done-run";
import { CopyButton } from "@/components/copy-button";

interface LazyResult {
  runId: string;
  message: string;
  resultKind: string;
  campaignId?: string;
  contentId?: string;
  offline: boolean;
}
interface Asset { id: string; kind: string; title?: string | null; body: string }

type Phase = "idle" | "working" | "done" | "error";

const STAGES = [
  "Reading your business",
  "Checking what needs attention",
  "Finding the best opportunity",
  "Creating it",
];

const ASSET_LABELS: Record<string, string> = {
  instagram_post: "Instagram post", caption: "Caption", story: "Story", reel: "Reel",
  whatsapp: "WhatsApp / DM", sales_message: "Sales message", followup: "Follow-up",
  cta: "Call to action", ad: "Ad", checklist: "Checklist",
};

export function LazyHero({ autoStart = false }: { autoStart?: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState(0);
  const [pressing, setPressing] = useState(false);
  const [result, setResult] = useState<LazyResult | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(false);

  const clearTimer = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };

  const run = useCallback(async () => {
    if (phase === "working") return;
    setPressing(true);
    setTimeout(() => setPressing(false), 340);
    setPhase("working");
    setStage(0);
    setError(null);
    setAssets([]);

    // Advance stages while the real request is in flight (stops before the last).
    clearTimer();
    timer.current = setInterval(() => {
      setStage((s) => (s < STAGES.length - 2 ? s + 1 : s));
    }, 750);

    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    try {
      const data = await api<LazyResult>("/api/lazy", { method: "POST", body: { idempotencyKey } });
      clearTimer();
      setStage(STAGES.length - 1); // "Creating it" complete
      if (data.campaignId) {
        try {
          const c = await api<{ campaign: { assets: Asset[] } }>(`/api/campaigns/${data.campaignId}`);
          setAssets(c.campaign.assets);
        } catch { /* reveal without assets */ }
      }
      // Small deliberate beat so the final check reads as intentional.
      await new Promise((r) => setTimeout(r, 320));
      setResult(data);
      setPhase("done");
      router.refresh();
    } catch (err) {
      clearTimer();
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Try again.");
      setPhase("error");
    }
  }, [phase, router]);

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      run();
    }
    return clearTimer;
  }, [autoStart, run]);

  // Mouse-follow highlight (cheap: CSS vars only).
  function onMove(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  }

  if (phase === "working") return <LazyProgress stage={stage} />;
  if (phase === "done" && result) return <LazyResultView result={result} assets={assets} onAgain={() => { setPhase("idle"); setResult(null); }} runAgain={run} />;

  return (
    <div>
      <p className="eyebrow mb-2.5 text-center">Just press</p>
      <button
        onClick={run}
        onMouseMove={onMove}
        aria-label="I'M LAZY — let DONE decide and create"
        className={`group relative w-full overflow-hidden rounded-[1.6rem] px-7 py-7 text-white transition-all duration-200 hover:-translate-y-0.5 ${pressing ? "lazy-pressing" : ""}`}
        style={{ background: "linear-gradient(120deg,#2563eb,#3b82f6 45%,#06b6d4)", boxShadow: "0 24px 70px -26px rgba(37,99,235,0.75)" }}
      >
        {/* mouse-follow sheen */}
        <span
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: "radial-gradient(24rem 16rem at var(--mx,50%) var(--my,0%), rgba(255,255,255,0.28), transparent 60%)" }}
        />
        <span className="relative flex items-center justify-between gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <BoltIcon className="h-5 w-5" />
          </span>
          <span className="text-center">
            <span className="block text-3xl font-semibold tracking-tight sm:text-4xl">I&apos;M LAZY</span>
            <span className="mt-0.5 block text-sm text-white/80">Let DONE decide what to do — and do it.</span>
          </span>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur transition-transform duration-200 group-hover:translate-x-1">
            <IconArrow className="h-5 w-5" />
          </span>
        </span>
      </button>

      {phase === "error" && error ? (
        <div className="card mt-4 border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}{" "}
          <button onClick={run} className="font-medium underline">Try again</button>
        </div>
      ) : null}
    </div>
  );
}

function LazyProgress({ stage }: { stage: number }) {
  const steps: RunStep[] = STAGES.map((label, i) => ({
    label,
    state: i < stage ? "done" : i === stage ? "active" : "pending",
  }));
  return <DoneRun title="I've got you." subtitle="Give me a moment…" steps={steps} />;
}

function LazyResultView({
  result, assets, onAgain, runAgain,
}: {
  result: LazyResult; assets: Asset[]; onAgain: () => void; runAgain: () => void;
}) {
  const target = result.resultKind === "campaign" ? "/campaigns" : result.resultKind === "content" ? "/content" : result.resultKind === "followup" ? "/leads" : result.resultKind === "week_plan" ? "/plan" : "/dashboard";
  return (
    <div className="animate-slide-up-lg">
      <div className="card overflow-hidden p-7">
        <div className="flex items-center gap-3">
          <SuccessCheck />
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">DONE.</h2>
            {result.offline ? <span className="chip chip-scheduled">offline mode</span> : null}
          </div>
        </div>
        <p className="mt-3 max-w-xl text-ink-soft">{result.message}</p>

        {assets.length > 0 ? (
          <div className="stagger mt-6 grid gap-3 sm:grid-cols-2">
            {assets.slice(0, 6).map((a, i) => (
              <div key={a.id} className="rounded-2xl border border-line bg-surface/50 p-4" style={{ ["--i" as string]: i }}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="eyebrow">{ASSET_LABELS[a.kind] || a.kind}</span>
                  <CopyButton text={a.body} />
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap text-sm text-ink">{a.body}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <a href={target} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-brand to-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.8)] hover:to-brand-700">
            Review it <IconArrow className="h-4 w-4" />
          </a>
          <button onClick={runAgain} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface">
            Do something else
          </button>
          <button onClick={onAgain} className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:text-ink">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessCheck() {
  return (
    <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-600 animate-scale-in">
      <svg viewBox="0 0 24 24" className="success-check h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 10 17 19 7" />
      </svg>
    </span>
  );
}
