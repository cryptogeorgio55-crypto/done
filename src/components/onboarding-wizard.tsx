"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES } from "@/lib/industries";
import { api, ClientApiError } from "@/lib/client";
import { Button, Field, Input, Textarea, Select, Alert } from "@/components/ui";
import { BoltIcon } from "@/components/brand";

const GOALS = [
  ["bookings", "Get more bookings"],
  ["sales", "Sell more products"],
  ["awareness", "Build awareness"],
  ["repeat", "Increase repeat customers"],
  ["leads", "Generate leads"],
  ["engagement", "More social engagement"],
];

type Form = {
  businessName: string;
  industryKey: string;
  description: string;
  products: string;
  location: string;
  website: string;
  instagram: string;
  idealCustomer: string;
  goal: string;
  tone: string;
};

const STEPS = ["Business", "What you do", "Reach", "Customers & goal"];

export function OnboardingWizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({
    businessName: initialName,
    industryKey: INDUSTRIES[0].key,
    description: "",
    products: "",
    location: "",
    website: "",
    instagram: "",
    idealCustomer: "",
    goal: "bookings",
    tone: "Friendly and professional",
  });

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canNext =
    (step === 0 && form.businessName.trim().length > 0) ||
    (step === 1 && form.description.trim().length > 0) ||
    step === 2 ||
    step === 3;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const { redirect } = await api<{ redirect: string }>("/api/onboarding", {
        method: "POST",
        body: form,
      });
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't save. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-line"}`}
            />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Tell us about your business</h2>
            <Field label="Business name" htmlFor="bn">
              <Input id="bn" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
            </Field>
            <Field label="Industry" htmlFor="ind">
              <Select id="ind" value={form.industryKey} onChange={(e) => set("industryKey", e.target.value)}>
                {INDUSTRIES.map((i) => (
                  <option key={i.key} value={i.key}>{i.label}</option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">What do you sell or do?</h2>
            <Field label="Describe your business" htmlFor="desc" hint="One or two sentences is plenty.">
              <Textarea id="desc" value={form.description} onChange={(e) => set("description", e.target.value)}
                placeholder="We're a nail salon offering gel manicures, nail art and pedicures." />
            </Field>
            <Field label="Main products or services" htmlFor="prod" hint="One per line or comma-separated.">
              <Textarea id="prod" value={form.products} onChange={(e) => set("products", e.target.value)}
                placeholder="Gel manicure&#10;Nail art&#10;Pedicure" />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Where can people find you?</h2>
            <Field label="Location" htmlFor="loc">
              <Input id="loc" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Manchester, UK" />
            </Field>
            <Field label="Website" htmlFor="web">
              <Input id="web" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Instagram" htmlFor="ig">
              <Input id="ig" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@yourbusiness" />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Your customers & goal</h2>
            <Field label="Who is your ideal customer?" htmlFor="ic">
              <Textarea id="ic" value={form.idealCustomer} onChange={(e) => set("idealCustomer", e.target.value)}
                placeholder="Women 25–45 locally who want quality nails for events and self-care." />
            </Field>
            <Field label="Main goal right now" htmlFor="goal">
              <Select id="goal" value={form.goal} onChange={(e) => set("goal", e.target.value)}>
                {GOALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Preferred tone" htmlFor="tone">
              <Input id="tone" value={form.tone} onChange={(e) => set("tone", e.target.value)} />
            </Field>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Continue</Button>
          ) : (
            <Button onClick={submit} disabled={saving}>
              <BoltIcon className="h-4 w-4" /> {saving ? "Building your Business Brain…" : "Finish"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
