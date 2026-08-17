"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ClientApiError } from "@/lib/client";
import { Button, Input, Select, Alert, Badge, PageHeader, EmptyState } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { IconLeads } from "@/components/icons";

interface Lead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  stage: string;
  notes?: string | null;
}

const STAGES = ["new", "contacted", "interested", "followup", "won", "lost"];
const STAGE_TONE: Record<string, "brand" | "amber" | "gray" | "green"> = {
  new: "brand",
  contacted: "gray",
  interested: "amber",
  followup: "amber",
  won: "green",
  lost: "gray",
};
// Honest reads of what each stage implies — no fabricated confidence scores.
const STAGE_INTENT: Record<string, string> = {
  new: "Just came in. Worth a quick, warm welcome.",
  contacted: "You've reached out — waiting to hear back.",
  interested: "Showing buying signals. Good moment to move them forward.",
  followup: "Due for a nudge. Don't let this one go cold.",
  won: "Closed. Keep the relationship warm.",
  lost: "Marked lost. Reactivation is still possible.",
};
// Hot first, then new work, then closed — so attention lands where it matters.
const STAGE_RANK: Record<string, number> = { followup: 0, interested: 1, new: 2, contacted: 3, won: 4, lost: 5 };

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [stage, setStage] = useState("new");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState<{ leadId: string; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ leads: Lead[] }>("/api/leads");
      setLeads(data.leads);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't load leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await api("/api/leads", { method: "POST", body: { name, stage, notes } });
      setName("");
      setNotes("");
      setStage("new");
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't add lead.");
    }
  }

  async function draftFollowUp(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const data = await api<{ followUp: { message: string } }>(`/api/leads/${id}/followup`, {
        method: "POST",
      });
      setFollowUp({ leadId: id, text: data.followUp.message });
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't draft a follow-up.");
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...leads].sort((a, b) => (STAGE_RANK[a.stage] ?? 9) - (STAGE_RANK[b.stage] ?? 9));
  const hotCount = leads.filter((l) => l.stage === "interested" || l.stage === "followup").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Relationships"
        title="Who needs attention?"
        subtitle="DONE reads where each relationship stands and writes the personal move at the right moment."
        action={hotCount > 0 ? <Badge tone="amber">{hotCount} hot</Badge> : undefined}
      />

      {error ? <Alert>{error}</Alert> : null}

      <form onSubmit={addLead} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead name" className="flex-1" />
        <Select value={stage} onChange={(e) => setStage(e.target.value)} className="sm:w-44">
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="flex-1" />
        <Button type="submit" className="shrink-0">Add lead</Button>
      </form>

      {loading ? (
        <div className="card p-8 text-center text-ink-soft">Loading…</div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<IconLeads className="h-6 w-6" />}
          title="Nobody to follow up with."
          body="Add your first lead above and DONE will tell you exactly when and what to send."
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((lead) => {
            const hot = lead.stage === "interested" || lead.stage === "followup";
            return (
            <div key={lead.id} className={`card p-4 ${hot ? "border-amber-200" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{lead.name}</span>
                  <Badge tone={STAGE_TONE[lead.stage] || "gray"}>{lead.stage}</Badge>
                  {lead.source ? <span className="text-xs text-muted">via {lead.source}</span> : null}
                </div>
                <Button variant={hot ? "primary" : "secondary"} onClick={() => draftFollowUp(lead.id)} disabled={busyId === lead.id}>
                  {busyId === lead.id ? "Working…" : "Let DONE handle it"}
                </Button>
              </div>
              {/* What DONE knows — an honest read of the relationship */}
              <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-soft">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {STAGE_INTENT[lead.stage] ?? "Tracked."}
              </p>
              {lead.notes ? <p className="mt-1 pl-3 text-sm text-muted">“{lead.notes}”</p> : null}
              {followUp?.leadId === lead.id ? (
                <div className="mt-3 rounded-xl border border-line bg-surface p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Suggested follow-up</span>
                    <CopyButton text={followUp.text} />
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-ink">{followUp.text}</p>
                </div>
              ) : null}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
