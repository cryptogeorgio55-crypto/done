"use client";

import { useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client";
import { Button, Field, Input, Textarea, Alert } from "@/components/ui";

interface Brain {
  businessName: string;
  description: string;
  location: string;
  website: string;
  instagram: string;
  tone: string;
  idealCustomer: string;
  products: string;
}

const EMPTY: Brain = {
  businessName: "",
  description: "",
  location: "",
  website: "",
  instagram: "",
  tone: "",
  idealCustomer: "",
  products: "",
};

export default function BrainPage() {
  const [brain, setBrain] = useState<Brain>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<Brain>("/api/brain")
      .then((d) => setBrain({ ...EMPTY, ...d }))
      .catch((err) => setError(err instanceof ClientApiError ? err.message : "Couldn't load."))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Brain>(k: K, v: Brain[K]) {
    setBrain((b) => ({ ...b, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api("/api/brain", { method: "PUT", body: brain });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card p-8 text-center text-ink-soft">Loading your Business Brain…</div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Business Brain</h1>
        <p className="mt-1 text-ink-soft">What DONE knows about your business. Edit anytime.</p>
      </header>

      {error ? <Alert>{error}</Alert> : null}
      {saved ? <Alert kind="info">Saved. DONE will use this in everything it creates.</Alert> : null}

      <div className="card space-y-4 p-6">
        <Field label="Business name" htmlFor="bn">
          <Input id="bn" value={brain.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="desc">
          <Textarea id="desc" value={brain.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Products / services" htmlFor="prod" hint="One per line.">
          <Textarea id="prod" value={brain.products} onChange={(e) => set("products", e.target.value)} />
        </Field>
        <Field label="Ideal customer" htmlFor="ic">
          <Textarea id="ic" value={brain.idealCustomer} onChange={(e) => set("idealCustomer", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" htmlFor="loc">
            <Input id="loc" value={brain.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Tone of voice" htmlFor="tone">
            <Input id="tone" value={brain.tone} onChange={(e) => set("tone", e.target.value)} />
          </Field>
          <Field label="Website" htmlFor="web">
            <Input id="web" value={brain.website} onChange={(e) => set("website", e.target.value)} />
          </Field>
          <Field label="Instagram" htmlFor="ig">
            <Input id="ig" value={brain.instagram} onChange={(e) => set("instagram", e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}
