"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark, BoltIcon } from "@/components/brand";
import { api } from "@/lib/client";

const NAV = [
  { href: "/dashboard", label: "Today" },
  { href: "/campaigns", label: "Get Customers" },
  { href: "/content", label: "Content" },
  { href: "/replies", label: "Replies" },
  { href: "/leads", label: "Follow Ups" },
  { href: "/brain", label: "Business Brain" },
  { href: "/settings", label: "Settings" },
];

export function AppNav({
  workspaceName,
  isAdmin,
}: {
  workspaceName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const links = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-blue-50 text-brand" : "text-ink-soft hover:bg-surface"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      {isAdmin ? (
        <Link
          href="/admin"
          onClick={() => setOpen(false)}
          className="mt-1 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface"
        >
          Admin
        </Link>
      ) : null}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <Wordmark href="/dashboard" />
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="rounded-lg p-2 text-ink-soft hover:bg-surface"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${open ? "block" : "hidden"} border-b border-line bg-white p-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r`}
      >
        <div className="hidden lg:mb-6 lg:block">
          <Wordmark href="/dashboard" />
        </div>
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-brand to-cyan text-white">
            <BoltIcon className="h-3 w-3" />
          </span>
          <span className="truncate text-sm font-medium">{workspaceName}</span>
        </div>
        {links}
        <button
          onClick={logout}
          className="mt-4 w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface"
        >
          Sign out
        </button>
      </aside>
    </>
  );
}
