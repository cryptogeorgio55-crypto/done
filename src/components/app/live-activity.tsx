"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { IconCheck, IconArrow, IconSparkle } from "@/components/icons";

interface ActivityItem {
  id: string;
  tool: string;
  risk: string;
  status: string; // executed | blocked | pending_approval | failed
  decision: string | null;
  title: string;
  detail: string | null;
  reason: string | null;
  reversible: boolean;
  createdAt: string;
}

// Map a tool key (e.g. "gmail.send", "calendar.create_event") to a human source.
function sourceOf(tool: string): string {
  const key = tool.split(".")[0];
  return (
    {
      gmail: "Gmail",
      google_gmail: "Gmail",
      calendar: "Calendar",
      google_calendar: "Calendar",
      lead: "Leads",
      content: "Content",
      campaign: "Campaigns",
      reply: "Replies",
    }[key] ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type Visual = { badge: "done" | "review" | "blocked"; label: string; href?: string };
function visualOf(a: ActivityItem): Visual {
  if (a.status === "pending_approval" || a.decision === "approval")
    return { badge: "review", label: "Review", href: "/approvals" };
  if (a.status === "blocked" || a.status === "failed")
    return { badge: "blocked", label: a.status === "failed" ? "Failed" : "Blocked" };
  return { badge: "done", label: "Done" };
}

export function LiveActivity({ initial }: { initial?: ActivityItem[] }) {
  const [items, setItems] = useState<ActivityItem[] | null>(initial ?? null);
  const [error, setError] = useState(false);
  const seen = useRef<Set<string>>(new Set((initial ?? []).map((i) => i.id)));

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await api<{ activity: ActivityItem[] }>("/api/activity");
        if (!alive) return;
        setItems(data.activity);
        setError(false);
      } catch {
        if (alive) setError(true);
      }
    }
    if (!initial) load();
    // Keep the surface feeling alive without a full reload.
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [initial]);

  if (items === null) {
    return (
      <ol className="space-y-4" aria-busy>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex gap-3">
            <div className="skeleton h-3 w-10 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-2/3" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          </li>
        ))}
      </ol>
    );
  }

  if (error && items.length === 0) {
    return <p className="text-sm text-muted">Couldn&apos;t load activity. Retrying…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 py-2">
        <p className="text-[15px] font-medium text-ink">Nothing yet — DONE is watching.</p>
        <p className="text-sm text-ink-soft">
          As soon as something happens across your inbox, calendar and leads, it shows up here.
        </p>
      </div>
    );
  }

  const list = items.slice(0, 8);
  return (
    <ol className="relative space-y-4">
      {list.map((a, i) => {
        const v = visualOf(a);
        const isNew = !seen.current.has(a.id);
        if (isNew) seen.current.add(a.id);
        return (
          <li
            key={a.id}
            className={`flex gap-3 ${isNew ? "animate-slide-up" : ""}`}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="mt-0.5 w-11 shrink-0 text-xs font-medium tabular-nums text-muted">
              {timeOf(a.createdAt)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium leading-snug text-ink">{a.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {a.detail ? `${a.detail} · ` : ""}
                {sourceOf(a.tool)}
              </p>
            </div>
            {v.badge === "done" ? (
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <IconCheck className="h-3.5 w-3.5" />
              </span>
            ) : v.badge === "review" ? (
              <Link
                href={v.href!}
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-blue-100"
              >
                {v.label} <IconArrow className="h-3 w-3" />
              </Link>
            ) : (
              <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {v.label}
              </span>
            )}
          </li>
        );
      })}
      {items.length > list.length ? (
        <li className="pl-14">
          <Link href="/automations" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
            <IconSparkle className="h-3.5 w-3.5" /> See everything DONE has done
          </Link>
        </li>
      ) : null}
    </ol>
  );
}
