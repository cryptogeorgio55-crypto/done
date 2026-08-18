"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button, Card, Spinner, Alert, Badge } from "@/components/ui";
import { IconSparkle, IconBolt, IconCheck } from "@/components/icons";

interface GoalProgress {
  key: string;
  label: string;
  momentum: "ahead" | "on_track" | "at_risk" | "unknown";
  signal: string;
}
interface Brief {
  greetingName: string;
  whatChanged: string[];
  biggestOpportunity: { title: string; detail: string } | null;
  biggestRisk: { title: string; detail: string } | null;
  schedule: { title: string; at: string } | null;
  recommendation: string;
  goals: GoalProgress[];
  plan: { proposalId: string; title: string; agent: string; priority: string; missionable: boolean }[];
}

const MOMENTUM: Record<GoalProgress["momentum"], { label: string; tone: "green" | "amber" | "gray" }> = {
  ahead: { label: "Ahead", tone: "green" },
  on_track: { label: "On track", tone: "green" },
  at_risk: { label: "At risk", tone: "amber" },
  unknown: { label: "No signal", tone: "gray" },
};

export default function ChiefOfStaffPage() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState<{ launched: { title: string }[]; skipped: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ brief: Brief }>("/api/chief-of-staff");
      setBrief(res.brief);
      setError("");
    } catch {
      setError("Couldn't load your brief.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runToday() {
    setRunning(true);
    try {
      const res = await api<{ launched: { title: string }[]; skipped: number }>("/api/chief-of-staff/run-today", {
        method: "POST",
      });
      setRan(res);
    } catch {
      setError("Couldn't start today's plan.");
    } finally {
      setRunning(false);
    }
  }

  if (!brief) {
    return (
      <div className="flex items-center justify-center py-24">
        {error ? <Alert>{error}</Alert> : <Spinner className="h-6 w-6" />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-[var(--brand-600,#0d9488)]">
          <IconSparkle className="h-4 w-4" />
          <span>Chief of Staff</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Good morning, {brief.greetingName}.</h1>
        <p className="text-sm text-neutral-500">Here&apos;s what matters today.</p>
      </header>

      {error && <Alert>{error}</Alert>}

      <Card className="p-4">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">What changed</div>
        <ul className="space-y-1 text-sm">
          {brief.whatChanged.map((c, i) => (
            <li key={i} className="text-neutral-700">• {c}</li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-emerald-500">Biggest opportunity</div>
          {brief.biggestOpportunity ? (
            <>
              <div className="text-sm font-medium">{brief.biggestOpportunity.title}</div>
              <p className="mt-0.5 text-xs text-neutral-500">{brief.biggestOpportunity.detail}</p>
            </>
          ) : (
            <p className="text-sm text-neutral-400">Nothing standout right now.</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-500">Biggest risk</div>
          {brief.biggestRisk ? (
            <>
              <div className="text-sm font-medium">{brief.biggestRisk.title}</div>
              <p className="mt-0.5 text-xs text-neutral-500">{brief.biggestRisk.detail}</p>
            </>
          ) : (
            <p className="text-sm text-neutral-400">Nothing at risk.</p>
          )}
        </Card>
      </div>

      {brief.schedule && (
        <Card className="p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Next on your schedule</div>
          <div className="text-sm font-medium">{brief.schedule.title}</div>
          <p className="mt-0.5 text-xs text-neutral-500">{new Date(brief.schedule.at).toLocaleString()}</p>
        </Card>
      )}

      <Card className="border-[var(--brand-500,#14b8a6)]/30 bg-[var(--brand-50,#f0fdfa)] p-4">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--brand-600,#0d9488)]">
          Recommendation
        </div>
        <p className="text-sm text-neutral-800">{brief.recommendation}</p>
      </Card>

      {/* Run Today */}
      <div>
        {ran ? (
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <IconCheck className="h-4 w-4" /> Today is running
            </div>
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              {ran.launched.map((m, i) => (
                <li key={i}>• {m.title}</li>
              ))}
            </ul>
            {ran.skipped > 0 && (
              <p className="mt-1 text-xs text-neutral-400">{ran.skipped} already in progress — reused.</p>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {brief.plan.length > 0 && (
              <ul className="space-y-1 text-sm text-neutral-600">
                {brief.plan.map((p) => (
                  <li key={p.proposalId} className="flex items-center gap-2">
                    <Badge tone={p.priority === "high" ? "amber" : "gray"}>{p.agent}</Badge>
                    {p.title}
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={runToday} disabled={running}>
              {running ? <Spinner /> : <><IconBolt className="h-4 w-4" /> Run Today</>}
            </Button>
          </div>
        )}
      </div>

      {brief.goals.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-500">Goals</h2>
          <div className="space-y-2">
            {brief.goals.map((g) => {
              const m = MOMENTUM[g.momentum];
              return (
                <Card key={g.key} className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-sm font-medium">{g.label}</div>
                    <p className="text-xs text-neutral-500">{g.signal}</p>
                  </div>
                  <Badge tone={m.tone}>{m.label}</Badge>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
