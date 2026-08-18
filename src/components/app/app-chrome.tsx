"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Wordmark, BoltMark } from "@/components/brand";
import { CommandPalette } from "@/components/app/command-palette";
import {
  IconToday, IconCustomers, IconContent, IconReplies, IconLeads, IconBrain,
  IconAnalytics, IconSettings, IconSearch, IconSparkle, IconLogout,
  IconChevronsLeft, IconX, IconAutopilot, IconInbox, IconApprovals, IconPlug,
} from "@/components/icons";

const PRIMARY = [
  { href: "/autopilot", label: "Autopilot", Icon: IconAutopilot },
  { href: "/inbox", label: "Inbox", Icon: IconInbox },
  { href: "/approvals", label: "Approvals", Icon: IconApprovals },
  { href: "/dashboard", label: "Today", Icon: IconToday },
  { href: "/decision-room", label: "Decision Room", Icon: IconBrain },
  { href: "/campaigns", label: "Get Customers", Icon: IconCustomers },
  { href: "/content", label: "Content", Icon: IconContent },
  { href: "/replies", label: "Replies", Icon: IconReplies },
  { href: "/leads", label: "Follow Ups", Icon: IconLeads },
  { href: "/brain", label: "Business Brain", Icon: IconBrain },
];
const SECONDARY = [
  { href: "/connections", label: "Connections", Icon: IconPlug },
  { href: "/automations", label: "Automations", Icon: IconAutopilot },
  { href: "/analytics", label: "Analytics", Icon: IconAnalytics },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];
const MOBILE_TABS = [
  { href: "/dashboard", label: "Today", Icon: IconToday },
  { href: "/campaigns", label: "Customers", Icon: IconCustomers },
  { href: "/content", label: "Content", Icon: IconContent },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + "/");
}

export function AppChrome({
  workspaceName,
  userName,
  userEmail,
  isAdmin,
  children,
}: {
  workspaceName: string;
  userName: string;
  userEmail: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isActive = useActive();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("done_sidebar_collapsed") === "1");
  }, []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => {
      localStorage.setItem("done_sidebar_collapsed", v ? "0" : "1");
      return !v;
    });
  }, []);

  // ⌘K / Ctrl K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const initials = (userName || userEmail).slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-app bg-grid lg:flex">
      {/* ---------- Desktop sidebar ---------- */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col p-3 lg:flex transition-[width] duration-300 ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        <div className="flex h-full flex-col rounded-2xl border border-line bg-white/70 backdrop-blur-xl shadow-soft">
          <div className={`flex items-center px-4 py-4 ${collapsed ? "justify-center" : "justify-between"}`}>
            {collapsed ? <BoltMark /> : <Wordmark href="/dashboard" />}
            {!collapsed ? (
              <button onClick={toggleCollapsed} aria-label="Collapse sidebar" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink">
                <IconChevronsLeft className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {/* Ask DONE / command trigger */}
          <div className="px-3">
            <button
              onClick={() => setPaletteOpen(true)}
              className={`flex w-full items-center gap-2 rounded-xl border border-line bg-surface/70 py-2.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-ink ${collapsed ? "justify-center px-0" : "px-3"}`}
            >
              <IconSearch className="h-4 w-4 shrink-0" />
              {!collapsed ? (
                <>
                  <span className="flex-1 text-left">Ask DONE</span>
                  <kbd className="rounded-md border border-line bg-white px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
                </>
              ) : null}
            </button>
          </div>

          <nav className="mt-3 flex-1 space-y-1 overflow-y-auto px-3">
            {PRIMARY.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
            ))}
            <div className={`my-3 border-t border-line ${collapsed ? "mx-2" : ""}`} />
            {SECONDARY.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} />
            ))}
            {isAdmin ? (
              <NavLink href="/admin" label="Admin" Icon={IconSettings} active={isActive("/admin")} collapsed={collapsed} />
            ) : null}
          </nav>

          {/* Workspace / account */}
          <div className="border-t border-line p-3">
            {collapsed ? (
              <div className="grid place-items-center">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-cyan text-sm font-semibold text-white">{initials}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-cyan text-sm font-semibold text-white">{initials}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{workspaceName}</p>
                  <p className="truncate text-xs text-muted">{userEmail}</p>
                </div>
                <button onClick={logout} aria-label="Sign out" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink">
                  <IconLogout className="h-4 w-4" />
                </button>
              </div>
            )}
            {collapsed ? (
              <button onClick={toggleCollapsed} aria-label="Expand sidebar" className="mt-2 grid w-full place-items-center rounded-lg py-1.5 text-muted hover:bg-surface">
                <IconChevronsLeft className="h-4 w-4 rotate-180" />
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Wordmark href="/dashboard" />
        <button onClick={() => setPaletteOpen(true)} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-muted">
          <IconSearch className="h-4 w-4" /> Ask DONE
        </button>
      </div>

      {/* ---------- Main ---------- */}
      <main className="flex-1 pb-24 lg:pb-0">
        <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-10">{children}</div>
      </main>

      {/* ---------- Mobile bottom nav ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 py-2">
          {MOBILE_TABS.slice(0, 2).map((t) => <MobileTab key={t.href} {...t} active={isActive(t.href)} />)}
          <div className="flex flex-col items-center">
            <button onClick={() => setPaletteOpen(true)} aria-label="What should I get DONE?" className="-mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-cyan text-white shadow-glow active:scale-95 transition-transform">
              <IconSparkle className="h-6 w-6" />
            </button>
            <span className="mt-0.5 text-[10px] font-semibold text-brand">DONE</span>
          </div>
          <MobileTab {...MOBILE_TABS[2]} active={isActive(MOBILE_TABS[2].href)} />
          <button onClick={() => setSheetOpen(true)} className="flex flex-col items-center gap-1 py-1 text-muted">
            <IconLeads className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* ---------- Mobile "More" sheet ---------- */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm animate-fade" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-white p-5 pb-8 animate-slide-up-lg">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong" />
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{workspaceName}</p>
              <button onClick={() => setSheetOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-surface"><IconX className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[...PRIMARY.slice(3), ...SECONDARY].map(({ href, label, Icon }) => (
                <Link key={href} href={href} onClick={() => setSheetOpen(false)} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm font-medium text-ink hover:bg-surface">
                  <Icon className="h-5 w-5 text-ink-soft" /> {label}
                </Link>
              ))}
            </div>
            <button onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-medium text-ink-soft hover:bg-surface">
              <IconLogout className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      ) : null}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function NavLink({
  href, label, Icon, active, collapsed,
}: {
  href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode; active: boolean; collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-brand-50/80 text-brand" : "text-ink-soft hover:bg-surface hover:text-ink"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      {active ? <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand" /> : null}
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

function MobileTab({ href, label, Icon, active }: { href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-1 py-1 ${active ? "text-brand" : "text-muted"}`}>
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
