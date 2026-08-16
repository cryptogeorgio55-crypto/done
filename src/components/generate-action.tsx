"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ClientApiError } from "@/lib/client";
import { Button, Input, Select, Alert } from "@/components/ui";
import { BoltIcon } from "@/components/brand";

/**
 * Reusable "generate" control for campaigns / content / plan. Posts to `path`
 * and refreshes the server component list on success.
 */
export function GenerateAction({
  path,
  label,
  withObjective,
  contentTypes,
  defaultObjective,
}: {
  path: string;
  label: string;
  withObjective?: boolean;
  contentTypes?: { value: string; label: string }[];
  defaultObjective?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objective, setObjective] = useState(defaultObjective || "");
  const [type, setType] = useState(contentTypes?.[0]?.value || "");

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (withObjective && objective.trim()) body.objective = objective.trim();
      if (contentTypes) body.type = type;
      await api(path, { method: "POST", body });
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't generate. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-4">
      {error ? <div className="mb-3"><Alert>{error}</Alert></div> : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        {withObjective ? (
          <Input
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Optional: what's the goal? (e.g. fill weekend slots)"
            className="flex-1"
          />
        ) : null}
        {contentTypes ? (
          <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:w-56">
            {contentTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        ) : null}
        <Button onClick={run} disabled={loading} className="shrink-0">
          <BoltIcon className="h-4 w-4" /> {loading ? "Working…" : label}
        </Button>
      </div>
    </div>
  );
}
