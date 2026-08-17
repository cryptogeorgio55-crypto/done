import Link from "next/link";
import { configStatus, config } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Operational status for platform admins. Shows CONFIGURED / MISSING only —
// never any secret value, token, or key.
export default async function AdminSystemPage() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const rows = configStatus();
  const badge = (state: "ok" | "missing" | "n/a") => {
    if (state === "ok") return <span className="chip chip-published">configured</span>;
    if (state === "missing") return <span className="chip chip-scheduled">missing</span>;
    return <span className="chip chip-draft">not in this build</span>;
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">System</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Operational status</h1>
          <p className="mt-1 text-sm text-ink-soft">{config.isProd ? "Production" : "Development"} · no secrets are shown here.</p>
        </div>
        <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">← Admin</Link>
      </header>

      {/* Live health */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card flex items-center justify-between p-5">
          <div>
            <p className="font-semibold text-ink">Application</p>
            <p className="text-sm text-ink-soft">Web process serving requests</p>
          </div>
          <span className="chip chip-published">healthy</span>
        </div>
        <div className="card flex items-center justify-between p-5">
          <div>
            <p className="font-semibold text-ink">Database</p>
            <p className="text-sm text-ink-soft">Prisma connection</p>
          </div>
          <span className={`chip ${dbOk ? "chip-published" : "chip-archived"}`}>{dbOk ? "connected" : "down"}</span>
        </div>
      </section>

      {/* Configuration */}
      <section className="card overflow-hidden p-0">
        <div className="border-b border-line px-5 py-3">
          <p className="font-semibold text-ink">Configuration</p>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="font-medium text-ink">{r.label}</p>
                <p className="truncate text-sm text-muted">{r.detail}</p>
              </div>
              {badge(r.state)}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted">
        Run <code className="rounded bg-surface px-1.5 py-0.5">npm run production:check</code> and{" "}
        <code className="rounded bg-surface px-1.5 py-0.5">npm run production:test-connections</code> from the server for a full pre-flight.
      </p>
    </div>
  );
}
