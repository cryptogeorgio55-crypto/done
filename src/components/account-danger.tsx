"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ClientApiError } from "@/lib/client";
import { Button, Input, Alert } from "@/components/ui";

export function AccountDanger() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setError(null);
    try {
      const { redirect } = await api<{ redirect: string }>("/api/account/delete", {
        method: "POST",
        body: { confirm },
      });
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't delete the account.");
      setBusy(false);
    }
  }

  return (
    <div className="card border-red-100 p-6">
      <h3 className="font-semibold text-red-700">Delete account</h3>
      <p className="mt-1 text-sm text-ink-soft">
        This permanently deletes your account and all workspace data you own — campaigns, content,
        leads and history. This cannot be undone.
      </p>
      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder='Type DELETE to confirm'
          className="sm:w-64"
        />
        <Button
          onClick={del}
          disabled={busy || confirm !== "DELETE"}
          className="bg-red-600 hover:bg-red-700 sm:shrink-0"
        >
          {busy ? "Deleting…" : "Delete my account"}
        </Button>
      </div>
    </div>
  );
}
