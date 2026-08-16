"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ClientApiError } from "@/lib/client";
import { Button, Input, Select, Alert, Badge } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Follow Ups</h1>
        <p className="mt-1 text-ink-soft">Track leads and let DONE write personal follow-ups.</p>
      </header>

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
        <div className="card p-8 text-center text-ink-soft">No leads yet. Add your first one above.</div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div key={lead.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{lead.name}</span>
                  <Badge tone={STAGE_TONE[lead.stage] || "gray"}>{lead.stage}</Badge>
                </div>
                <Button variant="secondary" onClick={() => draftFollowUp(lead.id)} disabled={busyId === lead.id}>
                  {busyId === lead.id ? "Drafting…" : "Draft follow-up"}
                </Button>
              </div>
              {lead.notes ? <p className="mt-1.5 text-sm text-ink-soft">{lead.notes}</p> : null}
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
          ))}
        </div>
      )}
    </div>
  );
}
