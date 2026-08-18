"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Card, Button, Badge, PageHeader, Spinner, Alert, EmptyState } from "@/components/ui";
import { IconInbox, IconSparkle } from "@/components/icons";

interface Ev {
  id: string; type: string; source: string; category: string | null; status: string;
  title: string | null; summary: string | null; urgency: string | null; occurredAt: string;
}
const CAT_LABEL: Record<string, string> = {
  needs_attention: "Needs Attention", sales: "Sales", customers: "Customers",
  operations: "Operations", finance: "Finance", meetings: "Meetings",
  marketing: "Marketing", done_auto: "Done Automatically",
};
const CAT_TONE: Record<string, "brand" | "amber" | "gray" | "green"> = {
  needs_attention: "amber", sales: "brand", customers: "brand", finance: "amber",
  meetings: "green", done_auto: "green", operations: "gray", marketing: "brand",
};

export default function InboxPage() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load(category = filter) {
    const data = await api<{ events: Ev[]; counts: Record<string, number>; categoryOrder: string[] }>(
      `/api/inbox${category ? `?category=${category}` : ""}`
    );
    setEvents(data.events); setCounts(data.counts); setOrder(data.categoryOrder);
  }
  useEffect(() => { load("").catch((e) => setError(e.message)); }, []);

  async function sync() {
    setSyncing(true); setError(""); setNotice("");
    try {
      const r = await api<{ ingested: number; processed: number; actionsDone: number; approvals: number }>(
        "/api/inbox/sync", { method: "POST", body: { process: true } }
      );
      setNotice(`Synced ${r.ingested} new item(s). DONE handled ${r.actionsDone}, ${r.approvals} need approval.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function pick(cat: string) { setFilter(cat); load(cat).catch((e) => setError(e.message)); }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence center"
        title="Inbox"
        subtitle="Everything happening across your connected apps, categorized automatically."
        action={<Button loading={syncing} onClick={sync}><IconSparkle className="h-4 w-4" /> Sync & handle</Button>}
      />
      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice ? <Alert kind="info">{notice}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === ""} onClick={() => pick("")} label="All" count={Object.values(counts).reduce((a, b) => a + b, 0)} />
        {order.filter((c) => counts[c]).map((c) => (
          <FilterChip key={c} active={filter === c} onClick={() => pick(c)} label={CAT_LABEL[c] ?? c} count={counts[c]} />
        ))}
      </div>

      {!events ? (
        <div className="grid place-items-center py-20"><Spinner className="h-6 w-6 text-brand" /></div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<IconInbox className="h-6 w-6" />}
          title="Your inbox is quiet"
          body="Connect Gmail and press Sync — DONE will read, understand, and start handling what comes in."
          action={<Link href="/connections"><Button variant="secondary">Connect an app</Button></Link>}
        />
      ) : filter === "" ? (
        <InboxGrouped events={events} />
      ) : (
        <div className="space-y-2">{events.map((e) => <InboxRow key={e.id} e={e} />)}</div>
      )}
    </div>
  );
}

function needsYouOf(e: Ev): boolean {
  return e.status === "new" && (e.urgency === "high" || ["needs_attention", "sales", "finance", "customers"].includes(e.category ?? ""));
}

function InboxGrouped({ events }: { events: Ev[] }) {
  const needsYou = events.filter(needsYouOf);
  const rest = events.filter((e) => !needsYouOf(e));
  return (
    <div className="space-y-8">
      {needsYou.length > 0 ? (
        <section>
          <p className="zone-eyebrow mb-3 text-amber-600">Needs you</p>
          <div className="space-y-2">{needsYou.map((e) => <InboxRow key={e.id} e={e} emphasis />)}</div>
        </section>
      ) : null}
      <section>
        <p className="zone-eyebrow mb-3 text-muted">
          {needsYou.length > 0 ? "Everything else — DONE is on it" : "DONE is on it"}
        </p>
        {rest.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing else right now.</p>
        ) : (
          <div className="space-y-2">{rest.map((e) => <InboxRow key={e.id} e={e} />)}</div>
        )}
      </section>
    </div>
  );
}

function InboxRow({ e, emphasis = false }: { e: Ev; emphasis?: boolean }) {
  return (
    <Card hover className={`flex items-center justify-between gap-4 p-4 ${emphasis ? "border-amber-200 bg-amber-50/30" : ""}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {e.category ? <Badge tone={CAT_TONE[e.category] ?? "gray"}>{CAT_LABEL[e.category] ?? e.category}</Badge> : <Badge tone="gray">New</Badge>}
          {e.urgency === "high" ? <Badge tone="amber">Urgent</Badge> : null}
          <span className="text-xs text-muted">{new Date(e.occurredAt).toLocaleString()}</span>
        </div>
        <p className="mt-1 truncate font-medium text-ink">{e.title ?? e.type}</p>
        {e.summary ? <p className="truncate text-sm text-ink-soft">{e.summary}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <span className={`chip ${e.status === "processed" ? "chip-published" : e.status === "failed" ? "chip-archived" : "chip-draft"}`}>{e.status}</span>
      </div>
    </Card>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-brand bg-brand-50 text-brand" : "border-line bg-white text-ink-soft hover:border-line-strong"
      }`}
    >
      {label} <span className="text-xs text-muted">{count}</span>
    </button>
  );
}
