"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button, Spinner, Alert } from "@/components/ui";
import { IconApprovals, IconCheck, IconX, IconArrow } from "@/components/icons";

interface Approval {
  id: string; title: string; actionType: string; risk: string; source?: string | null;
  previewText?: string | null; reason?: string | null; status: string; createdAt: string;
  payload: { tool: string; input: Record<string, unknown> };
}

const RECIPIENT_HINT: Record<string, string> = {
  "gmail.send": "an email will be sent",
  "gmail.reply": "a reply will be sent",
  "calendar.create_event": "a calendar invite will go out",
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function load() {
    const data = await api<{ approvals: Approval[] }>("/api/approvals?status=pending");
    setApprovals(data.approvals);
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function decide(a: Approval, action: "approve" | "reject") {
    setBusy(a.id); setError("");
    try {
      const edited = drafts[a.id];
      const editedInput = edited !== undefined && "body" in a.payload.input ? { ...a.payload.input, body: edited } : undefined;
      await api(`/api/approvals/${a.id}`, { method: "POST", body: { action, editedInput } });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function approveAllLowRisk() {
    if (!approvals) return;
    setBatchBusy(true); setError("");
    try {
      for (const a of approvals.filter((x) => x.risk === "low")) {
        await api(`/api/approvals/${a.id}`, { method: "POST", body: { action: "approve" } });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBatchBusy(false);
    }
  }

  if (!approvals) return <div className="grid place-items-center py-24"><Spinner className="h-6 w-6 text-brand" /></div>;

  const lowRisk = approvals.filter((a) => a.risk === "low");

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Human in the loop</p>
        <h1 className="h-hero mt-2 text-ink">Needs you</h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          {approvals.length === 0
            ? "Nothing needs your call right now."
            : `${approvals.length} thing${approvals.length === 1 ? "" : "s"} DONE prepared but won't do without you.`}
        </p>
      </header>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {/* Batch approval for low-risk items */}
      {lowRisk.length > 1 ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-brand/20 bg-blue-50/40 p-5">
          <div>
            <p className="font-semibold text-ink">{lowRisk.length} low-risk things are ready.</p>
            <p className="text-sm text-ink-soft">Routine replies and follow-ups DONE is confident about.</p>
          </div>
          <Button loading={batchBusy} onClick={approveAllLowRisk}>
            <IconCheck className="h-4 w-4" /> Approve all {lowRisk.length}
          </Button>
        </div>
      ) : null}

      {approvals.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-brand">
            <IconApprovals className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-ink">Nothing needs you.</h3>
          <p className="mt-1 max-w-sm text-ink-soft">DONE is handling the rest. When something needs your call, it lands here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((a) => {
            const body = (a.payload?.input?.body as string) ?? "";
            const canEdit = typeof a.payload?.input?.body === "string";
            const isEditing = editingId === a.id;
            const highRisk = a.risk !== "low";
            const recipientHint = RECIPIENT_HINT[a.payload?.tool] ?? "this action will run";
            return (
              <article key={a.id} className="card overflow-hidden">
                {/* Decision header */}
                <div className={`flex items-center justify-between gap-3 px-6 py-4 ${highRisk ? "bg-amber-50/60" : "bg-surface/60"}`}>
                  <p className="text-lg font-semibold text-ink">
                    {highRisk ? "I need your call on this one." : "Ready when you are."}
                  </p>
                  <span className={`chip ${highRisk ? "chip-scheduled" : "chip-approved"}`}>{a.risk} risk</span>
                </div>

                <div className="space-y-4 p-6">
                  <div>
                    <p className="eyebrow mb-1.5">DONE wants to</p>
                    <p className="font-medium text-ink">{a.title}</p>
                  </div>

                  {canEdit && isEditing ? (
                    <textarea
                      value={drafts[a.id] ?? body}
                      onChange={(e) => setDrafts((s) => ({ ...s, [a.id]: e.target.value }))}
                      className="min-h-36 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                    />
                  ) : (drafts[a.id] ?? body) || a.previewText ? (
                    <blockquote className="rounded-xl border-l-2 border-brand/40 bg-surface/60 px-4 py-3 text-sm text-ink-soft">
                      {(drafts[a.id] ?? body) || a.previewText}
                    </blockquote>
                  ) : null}

                  {a.reason ? (
                    <div className="rounded-xl bg-blue-50/50 px-4 py-3">
                      <p className="text-xs font-semibold text-brand">Why DONE recommends this</p>
                      <p className="mt-0.5 text-sm text-ink-soft">{a.reason}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                    <span className="text-xs text-muted">
                      If approved, {recipientHint} · via {a.source ?? a.actionType}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => decide(a, "reject")} disabled={busy === a.id}>
                        <IconX className="h-4 w-4" /> Skip
                      </Button>
                      {canEdit ? (
                        <Button variant="secondary" size="sm" onClick={() => setEditingId(isEditing ? null : a.id)}>
                          {isEditing ? "Done editing" : "Edit"}
                        </Button>
                      ) : null}
                      <Button size="sm" loading={busy === a.id} onClick={() => decide(a, "approve")}>
                        <IconCheck className="h-4 w-4" /> {highRisk ? "Approve & send" : "Send"} <IconArrow className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
