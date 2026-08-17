"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconX } from "@/components/icons";

/**
 * DONE presence indicator. Not an avatar — light + language.
 * Shows "● DONE ACTIVE" and opens a compact status panel of what
 * DONE is currently watching. All values come from real system state.
 */
export function DoneStatus({
  watching,
  automations,
  issues = 0,
}: {
  watching: string[];
  automations: number;
  issues?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = watching.length > 0 || automations > 0;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink-soft backdrop-blur transition-colors hover:border-line-strong"
        aria-expanded={open}
      >
        <span className="relative flex h-2 w-2">
          {active ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          ) : null}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
        </span>
        DONE {active ? "ACTIVE" : "IDLE"}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-2xl border border-line bg-white p-4 shadow-lift animate-scale-in">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Status</p>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted hover:bg-surface hover:text-ink" aria-label="Close">
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {watching.length > 0 ? (
              watching.map((w) => (
                <li key={w} className="flex items-center gap-2 text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Watching {w}
                </li>
              ))
            ) : (
              <li className="text-ink-soft">Nothing connected yet.</li>
            )}
            <li className="flex items-center gap-2 text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {automations} automation{automations === 1 ? "" : "s"} running
            </li>
            <li className="flex items-center gap-2 text-ink-soft">
              {issues === 0 ? (
                <>
                  <IconCheck className="h-3.5 w-3.5 text-emerald-500" /> No issues
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {issues} need{issues === 1 ? "s" : ""} attention
                </>
              )}
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
