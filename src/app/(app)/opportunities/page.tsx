"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button, Card, Spinner, Alert, Badge } from "@/components/ui";
import { IconBolt, IconSparkle } from "@/components/icons";

interface Opportunity {
  id: string;
  kind: string;
  title: string;
  detail: string;
  count: number;
  action: string;
}
interface Prediction {
  id: string;
  subject: string;
  likelihood: "likely" | "worth_attention";
  statement: string;
  basis: string;
}
interface Anomaly {
  id: string;
  statement: string;
  basis: string;
}
interface SnapshotDiff {
  from: { at: string; label: string | null } | null;
  to: { at: string };
  changes: { metric: string; before: number; after: number; delta: number }[];
}
interface Insights {
  opportunities: Opportunity[];
  predictions: Prediction[];
  anomalies: Anomaly[];
  snapshot: SnapshotDiff;
}

export default function OpportunitiesPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<Insights>("/api/insights"));
      setError("");
    } catch {
      setError("Couldn't load insights.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function capture() {
    setCapturing(true);
    try {
      await api("/api/insights/snapshot", { method: "POST" });
      await load();
    } catch {
      setError("Couldn't capture a snapshot.");
    } finally {
      setCapturing(false);
    }
  }

  if (!data) {
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
          <span>Insights</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Money left on the table</h1>
        <p className="text-sm text-neutral-500">Grounded opportunities, predictions and anomalies — no invented numbers.</p>
      </header>

      {error && <Alert>{error}</Alert>}

      {/* Opportunities */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Revenue opportunities</h2>
        {data.opportunities.length === 0 ? (
          <Card className="p-4 text-sm text-neutral-500">No clear opportunities right now.</Card>
        ) : (
          <div className="space-y-2">
            {data.opportunities.map((o) => (
              <Card key={o.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{o.title}</div>
                  <Badge tone="green">{o.count}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">{o.detail}</p>
                <p className="mt-1 text-xs text-[var(--brand-600,#0d9488)]">{o.action}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Predictions */}
      {data.predictions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-500">Predictions</h2>
          <div className="space-y-2">
            {data.predictions.map((p) => (
              <Card key={p.id} className="p-3">
                <div className="flex items-center gap-2">
                  <Badge tone={p.likelihood === "likely" ? "amber" : "gray"}>
                    {p.likelihood === "likely" ? "Likely" : "Worth attention"}
                  </Badge>
                  <span className="text-sm font-medium">{p.subject}</span>
                </div>
                <p className="mt-1 text-sm text-neutral-700">{p.statement}</p>
                <p className="mt-0.5 text-xs text-neutral-400">{p.basis}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Anomalies */}
      {data.anomalies.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-500">Something looks unusual</h2>
          <div className="space-y-2">
            {data.anomalies.map((a) => (
              <Card key={a.id} className="p-3">
                <p className="text-sm text-neutral-700">{a.statement}</p>
                <p className="mt-0.5 text-xs text-neutral-400">{a.basis}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Snapshot diff */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">Since last snapshot</h2>
          <Button onClick={capture} disabled={capturing}>
            {capturing ? <Spinner /> : <><IconBolt className="h-4 w-4" /> Capture snapshot</>}
          </Button>
        </div>
        {!data.snapshot.from ? (
          <Card className="p-4 text-sm text-neutral-500">
            No baseline yet — capture a snapshot to start comparing over time.
          </Card>
        ) : data.snapshot.changes.length === 0 ? (
          <Card className="p-4 text-sm text-neutral-500">Nothing changed since your last snapshot.</Card>
        ) : (
          <Card className="divide-y divide-neutral-100 p-0">
            {data.snapshot.changes.map((c) => (
              <div key={c.metric} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-neutral-600">{c.metric}</span>
                <span className="flex items-center gap-2">
                  <span className="text-neutral-400">{c.before}</span>
                  <span className="text-neutral-300">→</span>
                  <span className="font-medium">{c.after}</span>
                  <span className={c.delta > 0 ? "text-emerald-600" : "text-red-500"}>
                    {c.delta > 0 ? `+${c.delta}` : c.delta}
                  </span>
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
