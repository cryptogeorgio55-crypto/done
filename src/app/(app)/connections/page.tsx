"use client";

import { useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client";
import { Card, Button, Badge, PageHeader, Spinner, Alert } from "@/components/ui";
import { IconPlug, IconCheck } from "@/components/icons";

interface Account {
  provider: string; status: string; mode: string; displayName?: string | null;
  health: string; lastSyncedAt?: string | null;
}
interface Integration {
  key: string; name: string; category: string; phase: number; description: string;
  permissions: string[]; implemented: boolean; oauth: boolean; account: Account | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  communication: "Communication", calendar: "Calendar", files: "Files",
  business: "Business", marketing: "Marketing", productivity: "Productivity",
};

export default function ConnectionsPage() {
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const data = await api<{ integrations: Integration[] }>("/api/integrations");
    setIntegrations(data.integrations);
  }
  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("connected")) setNotice("Connected successfully.");
      if (params.get("error")) setError(`Couldn't connect: ${params.get("error")}`);
    }
  }, []);

  async function connect(provider: string, oauth: boolean) {
    setBusy(provider); setError(""); setNotice("");
    try {
      if (oauth) {
        try {
          const { authorizeUrl } = await api<{ authorizeUrl: string }>("/api/integrations/google/start", {
            method: "POST", body: { provider },
          });
          window.location.href = authorizeUrl;
          return;
        } catch (e) {
          // OAuth not configured on this server → fall back to sandbox.
          if (!(e instanceof ClientApiError && e.api.code === "oauth_unconfigured")) throw e;
        }
      }
      await api("/api/integrations", { method: "POST", body: { action: "connect_sandbox", provider } });
      setNotice("Connected in sandbox mode — DONE will operate on a safe, simulated backend.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: string) {
    setBusy(provider); setError("");
    try {
      await api("/api/integrations", { method: "POST", body: { action: "disconnect", provider } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setBusy(null);
    }
  }

  if (!integrations) return <div className="grid place-items-center py-24"><Spinner className="h-6 w-6 text-brand" /></div>;

  const byCategory = integrations.reduce<Record<string, Integration[]>>((acc, i) => {
    (acc[i.category] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Connected apps"
        title="Connect your business"
        subtitle="DONE watches what happens across your tools and handles the work. Connect once — nothing appears as connected until it truly is."
      />
      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice ? <Alert kind="info">{notice}</Alert> : null}

      {Object.entries(byCategory).map(([cat, items]) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{CATEGORY_LABEL[cat] ?? cat}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((i) => {
              const connected = i.account?.status === "connected";
              return (
                <Card key={i.key} className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 text-brand"><IconPlug className="h-5 w-5" /></span>
                      <div>
                        <p className="font-semibold text-ink">{i.name}</p>
                        <p className="text-xs text-muted">Phase {i.phase}{i.account?.mode === "sandbox" ? " · Sandbox" : ""}</p>
                      </div>
                    </div>
                    {connected ? (
                      <Badge tone={i.account?.health === "ok" ? "green" : "amber"}>
                        {i.account?.health === "ok" ? "Connected" : "Needs attention"}
                      </Badge>
                    ) : i.implemented ? <Badge tone="gray">Not connected</Badge> : <Badge tone="gray">Coming soon</Badge>}
                  </div>
                  <p className="text-sm text-ink-soft">{i.description}</p>
                  {connected ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      DONE is watching · last sync {i.account?.lastSyncedAt ? new Date(i.account.lastSyncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "just now"}
                    </div>
                  ) : null}
                  {i.permissions.length ? (
                    <ul className="space-y-1">
                      {i.permissions.slice(0, 3).map((p) => (
                        <li key={p} className="flex items-center gap-2 text-xs text-muted"><IconCheck className="h-3.5 w-3.5 text-emerald-500" /> {p}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-auto flex gap-2 pt-1">
                    {!i.implemented ? (
                      <Button variant="secondary" size="sm" disabled>Coming soon</Button>
                    ) : connected ? (
                      <Button variant="secondary" size="sm" loading={busy === i.key} onClick={() => disconnect(i.key)}>Disconnect</Button>
                    ) : (
                      <Button size="sm" loading={busy === i.key} onClick={() => connect(i.key, i.oauth)}>Connect</Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
