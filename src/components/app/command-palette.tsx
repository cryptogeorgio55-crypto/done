"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import {
  IconSearch, IconToday, IconCustomers, IconContent, IconReplies, IconLeads,
  IconBrain, IconAnalytics, IconSettings, IconSparkle, IconArrow, IconApprovals,
  IconInbox, IconAutopilot, IconPlug,
} from "@/components/icons";

interface Action {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  href: string;
  keywords?: string;
  group: "suggested" | "do" | "go";
}

const NAV: Action[] = [
  { id: "next-move", label: "What matters now?", hint: "Next Move", icon: <IconSparkle className="h-4 w-4" />, href: "/dashboard", keywords: "next move recommendation what should i do priority", group: "do" },
  { id: "decision-room", label: "Bring a decision", hint: "Decision Room", icon: <IconBrain className="h-4 w-4" />, href: "/decision-room", keywords: "decide discount should i strategy analyze decision room", group: "do" },
  { id: "reply", label: "Reply to a customer", icon: <IconReplies className="h-4 w-4" />, href: "/replies", keywords: "message answer respond dm", group: "do" },
  { id: "content", label: "Create content", hint: "Post, reel, story", icon: <IconContent className="h-4 w-4" />, href: "/content", keywords: "instagram post caption reel story create", group: "do" },
  { id: "campaign", label: "Get customers", hint: "Build a campaign", icon: <IconCustomers className="h-4 w-4" />, href: "/campaigns", keywords: "campaign promotion offer ad acquire", group: "do" },
  { id: "today", label: "Today", icon: <IconToday className="h-4 w-4" />, href: "/dashboard", keywords: "home dashboard command center", group: "go" },
  { id: "inbox", label: "Inbox", icon: <IconInbox className="h-4 w-4" />, href: "/inbox", keywords: "email gmail messages needs you", group: "go" },
  { id: "approvals", label: "Needs you", hint: "Approvals", icon: <IconApprovals className="h-4 w-4" />, href: "/approvals", keywords: "approve decisions pending", group: "go" },
  { id: "autopilot", label: "Autopilot", icon: <IconAutopilot className="h-4 w-4" />, href: "/autopilot", keywords: "automations running handle", group: "go" },
  { id: "leads", label: "Who needs attention?", hint: "Leads", icon: <IconLeads className="h-4 w-4" />, href: "/leads", keywords: "lead crm follow up contact", group: "go" },
  { id: "brain", label: "Business Brain", icon: <IconBrain className="h-4 w-4" />, href: "/brain", keywords: "profile business knowledge", group: "go" },
  { id: "connections", label: "Connections", icon: <IconPlug className="h-4 w-4" />, href: "/connections", keywords: "integrations gmail calendar connect", group: "go" },
  { id: "analytics", label: "What DONE has done", hint: "Activity", icon: <IconAnalytics className="h-4 w-4" />, href: "/analytics", keywords: "stats metrics work done history", group: "go" },
  { id: "settings", label: "Settings", icon: <IconSettings className="h-4 w-4" />, href: "/settings", keywords: "account plan billing profile", group: "go" },
];

interface Briefing {
  sections: { key: string; label: string; count: number; detail: string }[];
  pendingApprovals: number;
  newInboxItems: number;
}

const GROUP_LABEL: Record<Action["group"], string> = {
  suggested: "Suggested for you",
  do: "Get something DONE",
  go: "Go to",
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [suggested, setSuggested] = useState<Action[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pull real business state to make suggestions contextual, not generic.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    api<{ briefing: Briefing }>("/api/briefing")
      .then(({ briefing }) => {
        if (!alive) return;
        const s: Action[] = [];
        if (briefing.pendingApprovals > 0)
          s.push({ id: "s-appr", label: `Review ${briefing.pendingApprovals} decision${briefing.pendingApprovals === 1 ? "" : "s"}`, icon: <IconApprovals className="h-4 w-4" />, href: "/approvals", group: "suggested" });
        const attn = briefing.sections.find((x) => x.key === "needs_attention");
        if (attn) s.push({ id: "s-attn", label: attn.detail, icon: <IconLeads className="h-4 w-4" />, href: "/leads", group: "suggested" });
        const meet = briefing.sections.find((x) => x.key === "meetings");
        if (meet) s.push({ id: "s-meet", label: "Prepare your next meeting", hint: meet.detail, icon: <IconToday className="h-4 w-4" />, href: "/autopilot", group: "suggested" });
        const mkt = briefing.sections.find((x) => x.key === "marketing");
        if (mkt) s.push({ id: "s-mkt", label: "Create today's post", hint: mkt.detail, icon: <IconContent className="h-4 w-4" />, href: "/content", group: "suggested" });
        if (briefing.newInboxItems > 0)
          s.push({ id: "s-inbox", label: `Handle ${briefing.newInboxItems} inbox item${briefing.newInboxItems === 1 ? "" : "s"}`, icon: <IconInbox className="h-4 w-4" />, href: "/inbox", group: "suggested" });
        setSuggested(s.slice(0, 4));
      })
      .catch(() => setSuggested([]));
    return () => { alive = false; };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Empty state: contextual suggestions first, then the "do" shortcuts.
      return [...suggested, ...NAV.filter((a) => a.group === "do")];
    }
    return NAV.filter((a) => `${a.label} ${a.hint ?? ""} ${a.keywords ?? ""}`.toLowerCase().includes(q));
  }, [query, suggested]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => setActive(0), [query, suggested]);

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

  // Track group boundaries so we can render headers inline.
  let lastGroup: Action["group"] | null = null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command menu">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-md animate-fade" onClick={onClose} />
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
        <div className="max-h-96 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">No actions match “{query}”. Try “follow up”, “post”, or “meeting”.</p>
          ) : (
            results.map((a, i) => {
              const showHeader = a.group !== lastGroup && !query.trim();
              lastGroup = a.group;
              return (
                <div key={a.id}>
                  {showHeader ? (
                    <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted first:pt-1">
                      {GROUP_LABEL[a.group]}
                    </p>
                  ) : null}
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(a)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${i === active ? "bg-surface" : "hover:bg-surface"}`}
                  >
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${a.group === "suggested" ? "bg-brand-50 text-brand" : i === active ? "bg-white text-brand shadow-sm" : "text-ink-soft"}`}>
                      {a.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{a.label}</span>
                      {a.hint ? <span className="block truncate text-xs text-muted">{a.hint}</span> : null}
                    </span>
                    {i === active ? <IconArrow className="h-4 w-4 text-muted" /> : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
