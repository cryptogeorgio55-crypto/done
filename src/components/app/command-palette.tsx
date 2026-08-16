"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconSearch, IconToday, IconCustomers, IconContent, IconReplies, IconLeads,
  IconBrain, IconAnalytics, IconSettings, IconSparkle, IconArrow,
} from "@/components/icons";

interface Action {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  href: string;
  keywords?: string;
}

const ACTIONS: Action[] = [
  { id: "lazy", label: "Run I'M LAZY", hint: "Let DONE decide & create", icon: <IconSparkle className="h-4 w-4" />, href: "/dashboard?lazy=1", keywords: "auto magic decide" },
  { id: "today", label: "Go to Today", icon: <IconToday className="h-4 w-4" />, href: "/dashboard", keywords: "home dashboard" },
  { id: "campaign", label: "Get customers", hint: "Build a campaign", icon: <IconCustomers className="h-4 w-4" />, href: "/campaigns", keywords: "campaign promotion offer ad acquire" },
  { id: "content", label: "Create content", hint: "Post, reel, story", icon: <IconContent className="h-4 w-4" />, href: "/content", keywords: "instagram post caption reel story" },
  { id: "reply", label: "Reply to a customer", icon: <IconReplies className="h-4 w-4" />, href: "/replies", keywords: "message answer respond dm" },
  { id: "leads", label: "Follow up leads", icon: <IconLeads className="h-4 w-4" />, href: "/leads", keywords: "lead crm follow up contact" },
  { id: "plan", label: "Plan my week", icon: <IconToday className="h-4 w-4" />, href: "/plan", keywords: "weekly plan schedule" },
  { id: "brain", label: "Open Business Brain", icon: <IconBrain className="h-4 w-4" />, href: "/brain", keywords: "profile business knowledge" },
  { id: "analytics", label: "View analytics", icon: <IconAnalytics className="h-4 w-4" />, href: "/analytics", keywords: "stats metrics work done" },
  { id: "settings", label: "Settings", icon: <IconSettings className="h-4 w-4" />, href: "/settings", keywords: "account plan billing profile" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIONS;
    return ACTIONS.filter((a) =>
      `${a.label} ${a.hint ?? ""} ${a.keywords ?? ""}`.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  function run(a: Action) {
    onClose();
    router.push(a.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[active]) run(results[active]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command menu">
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-white shadow-[0_30px_80px_-30px_rgba(10,15,30,0.5)] animate-scale-in">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <IconSearch className="h-5 w-5 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="What should I get DONE?"
            className="w-full bg-transparent py-4 text-[15px] text-ink placeholder:text-muted focus:outline-none"
          />
          <kbd className="hidden rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted sm:block">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">No actions match “{query}”.</p>
          ) : (
            results.map((a, i) => (
              <button
                key={a.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(a)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  i === active ? "bg-surface" : "hover:bg-surface"
                }`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${i === active ? "bg-white text-brand shadow-sm" : "text-ink-soft"}`}>
                  {a.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{a.label}</span>
                  {a.hint ? <span className="block truncate text-xs text-muted">{a.hint}</span> : null}
                </span>
                {i === active ? <IconArrow className="h-4 w-4 text-muted" /> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
