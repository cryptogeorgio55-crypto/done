"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Card, Button, Badge, PageHeader, Spinner, Alert, Input, Select, Field } from "@/components/ui";
import { IconCheck } from "@/components/icons";

type Decision = "auto" | "approval" | "never" | "ignore";
interface Config {
  level: string; paused: boolean;
  categoryPolicies: Record<string, Decision>;
  senderName?: string | null; signature?: string | null;
  dailyActionLimit: number;
}
interface Rule { id: string; category: string; rule: string; }

const LEVELS = [
  { key: "assist", name: "Assist", desc: "DONE analyzes and recommends. Never takes external action." },
  { key: "prepare", name: "Prepare", desc: "DONE drafts replies and actions for your approval." },
  { key: "autopilot", name: "Autopilot", desc: "DONE performs approved categories automatically." },
  { key: "custom", name: "Custom", desc: "Granular control, per action type." },
];
const CATEGORIES: { key: string; label: string }[] = [
  { key: "sales_reply", label: "Reply to new sales inquiries" },
  { key: "customer_reply", label: "Reply to existing customers" },
  { key: "complaint", label: "Respond to complaints" },
  { key: "schedule_meeting", label: "Schedule meetings" },
  { key: "send_quotation", label: "Send quotations" },
  { key: "send_followup", label: "Send follow-ups" },
  { key: "create_lead", label: "Create leads" },
  { key: "update_lead", label: "Update leads / CRM" },
  { key: "financial", label: "Financial / legal" },
  { key: "destructive", label: "Delete / cancel / refund" },
];
const RULE_CATEGORIES = ["communication", "sales", "scheduling", "discount", "support", "approval", "escalation"];

export default function HowDoneWorksPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newRule, setNewRule] = useState({ category: "communication", rule: "" });

  async function load() {
    const [c, r] = await Promise.all([
      api<{ config: Config }>("/api/autonomy"),
      api<{ rules: Rule[] }>("/api/operating-rules"),
    ]);
    setConfig(c.config); setRules(r.rules);
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function save(patch: Partial<Config>) {
    setSaving(true); setError(""); setNotice("");
    try {
      const c = await api<{ config: Config }>("/api/autonomy", { method: "PUT", body: patch });
      setConfig(c.config); setNotice("Saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function addRule() {
    if (newRule.rule.trim().length < 3) return;
    try {
      await api("/api/operating-rules", { method: "POST", body: newRule });
      setNewRule({ category: "communication", rule: "" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  async function delRule(id: string) {
    try { await api("/api/operating-rules", { method: "DELETE", body: { id } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  if (!config) return <div className="grid place-items-center py-24"><Spinner className="h-6 w-6 text-brand" /></div>;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Operating manual" title="How DONE should work" subtitle="Set how much DONE can do on its own, and the rules it must always follow." />
      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice ? <Alert kind="info">{notice}</Alert> : null}

      {/* Autonomy level */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Autonomy level</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {LEVELS.map((l) => (
            <button key={l.key} onClick={() => save({ level: l.key })} disabled={saving}
              className={`rounded-2xl border p-4 text-left transition-all ${config.level === l.key ? "border-brand bg-blue-50/60 ring-2 ring-brand/20" : "border-line bg-white hover:border-line-strong"}`}>
              <div className="flex items-center justify-between"><p className="font-semibold text-ink">{l.name}</p>{config.level === l.key ? <IconCheck className="h-5 w-5 text-brand" /> : null}</div>
              <p className="mt-1 text-sm text-ink-soft">{l.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Category policies */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Action rules</h2>
        <p className="text-sm text-ink-soft">Financial and destructive actions can never run automatically — that&apos;s enforced regardless of these settings.</p>
        <Card className="divide-y divide-line p-0">
          {CATEGORIES.map((c) => {
            const val = config.categoryPolicies[c.key] ?? "approval";
            const locked = c.key === "financial" || c.key === "destructive";
            return (
              <div key={c.key} className="flex items-center justify-between gap-4 p-4">
                <span className="text-sm font-medium text-ink">{c.label}</span>
                {locked ? <Badge tone="gray">Never</Badge> : (
                  <Select value={val} disabled={saving} onChange={(e) => save({ categoryPolicies: { ...config.categoryPolicies, [c.key]: e.target.value as Decision } })} className="w-40">
                    <option value="auto">Automatic</option>
                    <option value="approval">Approval required</option>
                    <option value="never">Never</option>
                  </Select>
                )}
              </div>
            );
          })}
        </Card>
      </section>

      {/* Email identity */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Email identity</h2>
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Sender name"><Input defaultValue={config.senderName ?? ""} onBlur={(e) => save({ senderName: e.target.value })} placeholder="Your name" /></Field>
          <Field label="Daily automatic-action limit"><Input type="number" defaultValue={config.dailyActionLimit} onBlur={(e) => save({ dailyActionLimit: Number(e.target.value) })} /></Field>
          <div className="sm:col-span-2">
            <Field label="Signature" hint="Added to DONE-generated emails so they look like they came from you.">
              <textarea defaultValue={config.signature ?? ""} onBlur={(e) => save({ signature: e.target.value })}
                className="w-full min-h-24 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" placeholder={"Best,\nYour name\nYour Business · yourbusiness.com"} />
            </Field>
          </div>
        </Card>
      </section>

      {/* Operating rules */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Operating rules</h2>
        <p className="text-sm text-ink-soft">Plain-English rules DONE always follows — e.g. &quot;Never discount without asking me.&quot;</p>
        <Card className="space-y-3 p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={newRule.category} onChange={(e) => setNewRule((s) => ({ ...s, category: e.target.value }))} className="sm:w-44">
              {RULE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input value={newRule.rule} onChange={(e) => setNewRule((s) => ({ ...s, rule: e.target.value }))} placeholder="Never schedule calls before 10 AM." className="flex-1" />
            <Button onClick={addRule} disabled={newRule.rule.trim().length < 3}>Add</Button>
          </div>
          {rules.length ? (
            <ul className="divide-y divide-line">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm text-ink"><Badge tone="gray">{r.category}</Badge> <span className="ml-2">{r.rule}</span></span>
                  <button onClick={() => delRule(r.id)} className="text-xs text-muted hover:text-red-600">Remove</button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No rules yet.</p>}
        </Card>
      </section>
    </div>
  );
}
