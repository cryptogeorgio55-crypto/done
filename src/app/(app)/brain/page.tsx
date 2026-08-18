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

  const knowledge: { label: string; filled: boolean }[] = [
    { label: "Brand", filled: !!brain.businessName || !!brain.tone },
    { label: "What you sell", filled: !!brain.products },
    { label: "Customers", filled: !!brain.idealCustomer },
    { label: "Description", filled: !!brain.description },
    { label: "Location", filled: !!brain.location },
    { label: "Channels", filled: !!brain.website || !!brain.instagram },
  ];
  const knownCount = knowledge.filter((k) => k.filled).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Business Brain</p>
        <h1 className="display mt-2">
          {knownCount === 0
            ? "Teach DONE about your business."
            : <>DONE knows <span className="text-gradient">{knownCount} of {knowledge.length}</span> things about your business.</>}
        </h1>
        <p className="mt-2 max-w-xl text-ink-soft">The more it knows, the less you have to explain. This shapes everything DONE writes and decides.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {knowledge.map((k) => (
            <span key={k.label} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${k.filled ? "border-brand/20 bg-brand-50 text-brand" : "border-line bg-white text-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${k.filled ? "bg-brand" : "bg-line-strong"}`} /> {k.label}
            </span>
          ))}
        </div>
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
