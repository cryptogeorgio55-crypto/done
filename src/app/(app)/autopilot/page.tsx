"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Button, Spinner, Alert } from "@/components/ui";
import { DonePulse, type PulseState } from "@/components/app/done-pulse";
import { LiveActivity } from "@/components/app/live-activity";
import { DoneRun, type RunStep } from "@/components/app/done-run";
import { IconSparkle, IconPause, IconArrow, IconCheck } from "@/components/icons";

interface Briefing {
  greetingName: string;
  sections: { key: string; label: string; count: number; detail: string }[];
  pendingApprovals: number;
  newInboxItems: number;
}
interface AutonomyConfig { level: string; paused: boolean }
interface Integration { key: string; name: string; account: { status: string } | null }
interface SweepItem { title: string; status: string; detail?: string }

type Level = "assist" | "prepare" | "autopilot";
const LEVELS: { key: Level; label: string; blurb: string }[] = [
  { key: "assist", label: "Assist", blurb: "I recommend. You decide everything." },
  { key: "prepare", label: "Prepare", blurb: "I prepare everything. You send." },
  { key: "autopilot", label: "Autopilot", blurb: "I handle approved tasks myself." },
];

const HANDLING: Record<string, string[]> = {
  assist: [],
  prepare: [],
  autopilot: ["New sales inquiries", "Routine follow-ups", "Meeting preparation"],
  custom: ["Based on your rules"],
};
const APPROVAL: Record<string, string[]> = {
  assist: ["Everything — DONE only recommends"],
  prepare: ["Everything — DONE prepares, you send"],
  autopilot: ["Complaints", "Quotes & discounts", "Anything financial"],
  custom: ["Based on your rules"],
};

export default function AutopilotPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [config, setConfig] = useState<AutonomyConfig | null>(null);
  const [watching, setWatching] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [savingLevel, setSavingLevel] = useState(false);
  const [sweep, setSweep] = useState<{ message: string; items: SweepItem[] } | null>(null);
  const [error, setError] = useState("");

  async function loadAll() {
    const [b, c, ints] = await Promise.all([
      api<{ briefing: Briefing }>("/api/briefing"),
      api<{ config: AutonomyConfig }>("/api/autonomy"),
      api<{ integrations: Integration[] }>("/api/integrations").catch(() => ({ integrations: [] })),
    ]);
    setBriefing(b.briefing); setConfig(c.config);
    setWatching(ints.integrations.filter((i) => i.account?.status === "connected").map((i) => i.name));
  }
  useEffect(() => { loadAll().catch((e) => setError(e.message)); }, []);

  async function runLazy() {
    setRunning(true); setError(""); setSweep(null);
    try {
      const r = await api<{ message: string; items: SweepItem[] }>("/api/autopilot/run", { method: "POST" });
      setSweep(r);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRunning(false);
    }
  }

  async function togglePause() {
    if (!config) return;
    setPausing(true);
    try {
      await api("/api/autonomy", { method: "POST", body: { paused: !config.paused } });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setPausing(false);
    }
  }

  async function setLevel(level: Level) {
    if (!config || config.level === level) return;
    setSavingLevel(true); setError("");
    setConfig({ ...config, level }); // optimistic
    try {
      await api("/api/autonomy", { method: "PUT", body: { level } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      await loadAll();
    } finally {
      setSavingLevel(false);
    }
  }

  if (!briefing || !config) return <div className="grid place-items-center py-24"><Spinner className="h-6 w-6 text-brand" /></div>;

  const paused = config.paused;
  const pulseState: PulseState = paused ? "attention" : briefing.pendingApprovals > 0 ? "attention" : "active";
  const runSteps: RunStep[] = ["Checking inbox", "Checking calendar", "Reviewing leads", "Prioritizing opportunities"].map((label) => ({ label, state: "active" }));

  return (
    <div className="space-y-8">
      {/* Hero — operating an AI employee */}
      <section className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-ink-soft">
            <span className={`inline-block h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "bg-emerald-500"}`} />
            {paused ? "Autopilot paused" : "Autopilot is running"}
          </div>
          <h1 className="display mt-2">{paused ? "Autopilot is paused." : "Autopilot is running."}</h1>
          <p className="mt-2 max-w-lg text-lg text-ink-soft">
            {paused ? "DONE won't take any external action until you resume." : "DONE is watching your business and handling routine work."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button size="lg" loading={running} onClick={runLazy}><IconSparkle className="h-5 w-5" /> I&apos;M LAZY</Button>
            <Button variant="secondary" size="lg" onClick={togglePause} disabled={pausing}>
              <IconPause className="h-4 w-4" /> {paused ? "Resume" : "Pause"} autopilot
            </Button>
          </div>
        </div>
        <div className="hidden justify-self-center sm:block"><DonePulse state={pulseState} size={168} /></div>
      </section>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {/* Sweep result */}
      {running ? (
        <DoneRun title="Let me look around." subtitle="Scanning your business…" steps={runSteps} />
      ) : sweep ? (
        <div className="card space-y-3 p-6 animate-slide-up">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-cyan text-white"><IconSparkle className="h-5 w-5" /></span>
            <p className="text-lg font-semibold text-ink">{sweep.message}</p>
          </div>
          <ul className="space-y-2">
            {sweep.items.map((it, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm">
                <span className={`mt-0.5 chip ${it.status === "done" ? "chip-published" : it.status === "approval" ? "chip-scheduled" : "chip-draft"}`}>{it.status}</span>
                <div><p className="font-medium text-ink">{it.title}</p>{it.detail ? <p className="text-muted">{it.detail}</p> : null}</div>
              </li>
            ))}
          </ul>
          {sweep.items.some((i) => i.status === "approval") ? (
            <Link href="/approvals"><Button variant="secondary" size="sm">Review approvals <IconArrow className="h-4 w-4" /></Button></Link>
          ) : null}
        </div>
      ) : null}

      {/* Level control */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-ink">How much should DONE handle?</h2>
        <p className="mt-1 text-sm text-ink-soft">You&apos;re in control. Change this anytime.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {LEVELS.map((l) => {
            const selected = config.level === l.key;
            return (
              <button
                key={l.key}
                onClick={() => setLevel(l.key)}
                disabled={savingLevel}
                className={`rounded-2xl border p-4 text-left transition-all ${selected ? "border-brand bg-blue-50/50 ring-2 ring-brand/15" : "border-line hover:border-line-strong hover:bg-surface"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{l.label}</span>
                  {selected ? <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-white"><IconCheck className="h-3 w-3" /></span> : null}
                </div>
                <p className="mt-1 text-sm text-ink-soft">{l.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Watching / Handling / Needs approval */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ColumnCard title="Watching" tone="emerald" items={watching.length ? watching : ["Nothing connected yet"]} footer={<Link href="/connections" className="text-sm font-medium text-brand hover:underline">Manage connections →</Link>} />
        <ColumnCard title="Handling automatically" tone="brand" items={HANDLING[config.level] ?? []} empty="Nothing yet — raise the level to let DONE act." />
        <ColumnCard title="Needs your approval" tone="amber" items={APPROVAL[config.level] ?? []} footer={briefing.pendingApprovals > 0 ? <Link href="/approvals" className="text-sm font-medium text-brand hover:underline">{briefing.pendingApprovals} waiting →</Link> : undefined} />
      </div>

      {/* Recent activity */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">What DONE has done</h2>
        <div className="card p-6"><LiveActivity /></div>
      </section>
    </div>
  );
}

function ColumnCard({
  title, tone, items, footer, empty,
}: {
  title: string; tone: "emerald" | "brand" | "amber"; items: string[]; footer?: React.ReactNode; empty?: string;
}) {
  const dot = { emerald: "bg-emerald-500", brand: "bg-brand", amber: "bg-amber-500" }[tone];
  return (
    <div className="card p-5">
      <p className="eyebrow mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty ?? "Nothing here."}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it} className="flex items-center gap-2.5 text-sm text-ink">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} /> {it}
            </li>
          ))}
        </ul>
      )}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}
