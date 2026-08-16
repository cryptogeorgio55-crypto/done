"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ClientApiError } from "@/lib/client";
import { Button, Field, Input, Alert } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const { redirect } = await api<{ redirect: string }>(
        mode === "signup" ? "/api/auth/signup" : "/api/auth/login",
        { method: "POST", body: payload }
      );
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      {mode === "signup" ? (
        <>
          <Field label="Your name" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required placeholder="Jordan Smith" />
          </Field>
          <Field label="Business name" htmlFor="businessName">
            <Input id="businessName" name="businessName" placeholder="Glow Beauty Studio" required />
          </Field>
        </>
      ) : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@business.com" />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint={mode === "signup" ? "At least 8 characters, with a letter and a number." : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          placeholder="••••••••"
        />
      </Field>
      <Button type="submit" disabled={loading} className="w-full py-3">
        {loading ? "One moment…" : mode === "signup" ? "Create my account" : "Sign in"}
      </Button>
    </form>
  );
}
