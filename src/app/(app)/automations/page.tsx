"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Card, Button, Badge, PageHeader, Spinner, Alert, Input } from "@/components/ui";
import { IconAutopilot, IconSparkle, IconArrow } from "@/components/icons";

interface Rule { id: string; key: string | null; name: string; description: string | null; trigger: string; enabled: boolean; builtin: boolean; }
interface Run { id: string; trigger: string; status: string; message: string | null; summary: string | null; actionsDone: number; approvalsCount: number; startedAt: string; steps: number; }
interface Parsed { name: string; trigger: string; condition: string; actions: string[] }

// Reflect the real policy boundary: anything financial/sensitive/outbound-send
// stays human-approved. Mirrors src/lib/autonomy/policy.ts semantics for the UI.
const APPROVAL_WORDS = /discount|refund|price|quote|proposal|invoice|pay|contract|angry|complaint|send|reply|email/i;
function approvalNeeded(p: Parsed): boolean {
  return APPROVAL_WORDS.test([p.condition, ...p.actions].join(" "));
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [instruction, setInstruction] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const data = await api<{ rules: Rule[]; runs: Run[] }>("/api/automations");
    setRules(data.rules); setRuns(data.runs); setLoading(false);
  }
  useEffect(() => { load().catch((e) => { setError(e.message); setLoading(false); }); }, []);

  async function toggle(r: Rule) {
    setBusy(r.id);
    try {
      await api("/api/automations", { method: "POST", body: { action: "toggle", id: r.id, enabled: !r.enabled } });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  async function parse() {
    setParsing(true); setError(""); setParsed(null);
    try {
      const r = await api<{ parsed: Parsed }>("/api/automations", { method: "POST", body: { action: "parse", instruction } });
      setParsed(r.parsed);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't understand that"); }
    finally { setParsing(false); }
  }

  async function activate() {
    if (!parsed) return;
    setBusy("create");
    try {
      await api("/api/automations", { method: "POST", body: { action: "create", spec: parsed } });
      setParsed(null); setInstruction("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  if (loading) return <div className="grid place-items-center py-24"><Spinner className="h-6 w-6 text-brand" /></div>;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operating rules"
        title="How should DONE work?"
        subtitle="These are your standing instructions — like onboarding an employee. Toggle a rule, or just tell DONE a new one."
        action={<Link href="/how-done-works"><Button variant="secondary" size="sm">How DONE works</Button></Link>}
      />
      {error ? <Alert kind="error">{error}</Alert> : null}

      {/* Natural-language builder */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2"><IconSparkle className="h-5 w-5 text-brand" /><p className="font-semibold text-ink">Tell DONE a rule</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Never send discounts without asking me. Reply to new leads automatically."
            className="flex-1"
          />
          <Button loading={parsing} onClick={parse} disabled={instruction.trim().length < 4}>Understand</Button>
        </div>
        {parsed ? (
          <div className="rounded-xl border border-line bg-surface/60 p-4 animate-slide-up">
            <p className="text-sm font-medium text-ink">I understood:</p>
            <dl className="mt-2 grid gap-1.5 text-sm text-ink-soft sm:grid-cols-[auto_1fr] sm:gap-x-4">
              <dt className="text-muted">Trigger</dt><dd className="text-ink">{parsed.trigger}</dd>
              {parsed.condition ? (<><dt className="text-muted">Condition</dt><dd className="text-ink">{parsed.condition}</dd></>) : null}
              <dt className="text-muted">Actions</dt>
              <dd><ol className="ml-4 list-decimal text-ink">{parsed.actions.map((a, i) => <li key={i}>{a}</li>)}</ol></dd>
              <dt className="text-muted">Approval</dt>
              <dd className={approvalNeeded(parsed) ? "font-medium text-amber-700" : "font-medium text-emerald-700"}>
                {approvalNeeded(parsed) ? "Required — DONE will ask you first" : "Automatic once enabled"}
              </dd>
            </dl>
            <Button size="sm" className="mt-3" loading={busy === "create"} onClick={activate}>Save rule</Button>
          </div>
        ) : null}
      </Card>

      {/* Rules */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Active automations</h2>
        <div className="space-y-2">
          {rules.map((r) => (
            <Card key={r.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand"><IconAutopilot className="h-5 w-5" /></span>
                <div>
                  <p className="font-medium text-ink">{r.name} {r.builtin ? null : <Badge tone="gray">custom</Badge>}</p>
                  {r.description ? <p className="text-sm text-ink-soft">{r.description}</p> : null}
                </div>
              </div>
              <button
                onClick={() => toggle(r)}
                disabled={busy === r.id}
                aria-label={r.enabled ? "Disable" : "Enable"}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${r.enabled ? "bg-brand" : "bg-line-strong"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${r.enabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </Card>
          ))}
        </div>
      </section>

      {/* Runs */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Recent runs</h2>
        {runs.length === 0 ? (
          <Card className="p-5"><p className="text-ink-soft">No runs yet.</p></Card>
        ) : (
          <Card className="divide-y divide-line p-0">
            {runs.map((run) => (
              <div key={run.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{run.message ?? run.summary ?? run.trigger}</p>
                  <p className="text-xs text-muted">{run.trigger} · {run.actionsDone} action(s){run.approvalsCount ? ` · ${run.approvalsCount} approval(s)` : ""} · {new Date(run.startedAt).toLocaleString()}</p>
                </div>
                <span className={`chip ${run.status === "completed" ? "chip-published" : run.status === "needs_approval" ? "chip-scheduled" : run.status === "failed" ? "chip-archived" : "chip-draft"}`}>{run.status.replace("_", " ")}</span>
              </div>
            ))}
          </Card>
        )}
        <Link href="/approvals" className="inline-flex"><Button variant="ghost" size="sm">Go to approvals <IconArrow className="h-4 w-4" /></Button></Link>
      </section>
    </div>
  );
}
