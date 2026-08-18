"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button, Card, Spinner, Alert, Badge } from "@/components/ui";
import { IconSparkle, IconCheck, IconArrow } from "@/components/icons";

interface AgentStatus {
  id: string;
  role: string;
  proposals: number;
  ms: number;
  state: "working" | "idle" | "error";
}
interface MissionRef {
  id: string;
  title: string;
  kind: string;
  status: string;
  progress: number;
}
interface GoalProgress {
  key: string;
  label: string;
  momentum: "ahead" | "on_track" | "at_risk" | "unknown";
  signal: string;
  levers: string[];
}
interface Proposal {
  agent: string;
  title: string;
  summary: string;
  priority: string;
  subject: { type: string; id: string; label: string } | null;
  kind: string;
}
interface MissionControl {
  generatedAt: string;
  agents: AgentStatus[];
  activeMissions: MissionRef[];
  waiting: { approvals: number; missions: number };
  completedToday: number;
  topProposals: Proposal[];
  goals: GoalProgress[];
}

const AGENT_LABEL: Record<string, string> = {
  executive: "Executive",
  sales: "Sales",
  customer: "Customer",
  calendar: "Calendar",
  marketing: "Marketing",
  operations: "Operations",
};

const MOMENTUM_TONE: Record<GoalProgress["momentum"], { label: string; tone: "green" | "amber" | "gray" }> = {
  ahead: { label: "Ahead", tone: "green" },
  on_track: { label: "On track", tone: "green" },
  at_risk: { label: "At risk", tone: "amber" },
  unknown: { label: "No signal", tone: "gray" },
};

export default function MissionControlPage() {
  const [data, setData] = useState<MissionControl | null>(null);
  const [error, setError] = useState("");
  const [launching, setLaunching] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<MissionControl>("/api/mission-control");
      setData(res);
      setError("");
    } catch {
      setError("Couldn't load Mission Control.");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000); // live-ish view
    return () => clearInterval(t);
  }, [load]);

  async function launch(p: Proposal) {
    const proposalId = `${p.agent}:${p.subject?.id ?? p.kind}`;
    setLaunching(proposalId);
    try {
      await api("/api/missions", { method: "POST", body: { proposalId } });
      await load();
    } catch {
      setError("Couldn't launch that mission.");
    } finally {
      setLaunching(null);
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        {error ? <Alert>{error}</Alert> : <Spinner className="h-6 w-6" />}
      </div>
    );
  }

  const workingAgents = data.agents.filter((a) => a.state === "working").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-[var(--brand-600,#0d9488)]">
          <IconSparkle className="h-4 w-4" />
          <span>Mission Control</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Everything your AI team is doing</h1>
        <p className="text-sm text-neutral-500">
          {workingAgents} of {data.agents.length} agents active · {data.completedToday} actions handled today ·{" "}
          {data.waiting.approvals} awaiting your approval
        </p>
      </header>

      {error && <Alert>{error}</Alert>}

      {/* Agents */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Agents</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.agents.map((a) => (
            <Card key={a.id} className="flex items-center justify-between p-3">
              <div>
                <div className="text-sm font-medium">{AGENT_LABEL[a.id] ?? a.id}</div>
                <div className="text-xs text-neutral-500">{a.role}</div>
              </div>
              <span
                className={
                  "ml-2 inline-flex items-center gap-1 text-xs " +
                  (a.state === "working"
                    ? "text-emerald-600"
                    : a.state === "error"
                    ? "text-red-500"
                    : "text-neutral-400")
                }
              >
                <span
                  className={
                    "h-2 w-2 rounded-full " +
                    (a.state === "working"
                      ? "bg-emerald-500 animate-pulse"
                      : a.state === "error"
                      ? "bg-red-500"
                      : "bg-neutral-300")
                  }
                />
                {a.state === "working" ? "Working" : a.state === "error" ? "Error" : "Idle"}
              </span>
            </Card>
          ))}
        </div>
      </section>

      {/* Active missions */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Active missions</h2>
        {data.activeMissions.length === 0 ? (
          <Card className="p-4 text-sm text-neutral-500">
            No active missions. Launch one from a recommendation below.
          </Card>
        ) : (
          <div className="space-y-2">
            {data.activeMissions.map((m) => (
              <Card key={m.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{m.title}</div>
                  <Badge tone={m.status === "waiting_approval" ? "amber" : "green"}>
                    {m.status === "waiting_approval" ? "Needs approval" : "Active"}
                  </Badge>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-[var(--brand-500,#14b8a6)]"
                    style={{ width: `${Math.round(m.progress * 100)}%` }}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recommendations → launch missions */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Top recommendations</h2>
        {data.topProposals.length === 0 ? (
          <Card className="p-4 text-sm text-neutral-500">Nothing needs action right now. You're clear.</Card>
        ) : (
          <div className="space-y-2">
            {data.topProposals.map((p) => {
              const proposalId = `${p.agent}:${p.subject?.id ?? p.kind}`;
              return (
                <Card key={proposalId} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.title}</span>
                      <Badge tone={p.priority === "high" ? "amber" : "gray"}>{AGENT_LABEL[p.agent] ?? p.agent}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{p.summary}</p>
                  </div>
                  <Button onClick={() => launch(p)} disabled={launching === proposalId}>
                    {launching === proposalId ? <Spinner /> : <>Launch <IconArrow className="h-3.5 w-3.5" /></>}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Goals */}
      {data.goals.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-500">Goals</h2>
          <div className="space-y-2">
            {data.goals.map((g) => {
              const m = MOMENTUM_TONE[g.momentum];
              return (
                <Card key={g.key} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <IconCheck className="h-4 w-4 text-neutral-400" />
                      {g.label}
                    </div>
                    <Badge tone={m.tone}>{m.label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">{g.signal}</p>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
