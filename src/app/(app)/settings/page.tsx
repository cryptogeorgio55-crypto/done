import { requireWorkspaceContext } from "@/lib/workspace/context";
import { db } from "@/lib/db";
import { getEntitlements } from "@/lib/entitlements";
import { getUsageSnapshot } from "@/lib/usage";
import { AccountDanger } from "@/components/account-danger";
import { Badge } from "@/components/ui";

export default async function SettingsPage() {
  const ctx = await requireWorkspaceContext();
  const [sub, entitlements, usage] = await Promise.all([
    db.subscription.findUnique({ where: { workspaceId: ctx.workspace.id }, include: { plan: true } }),
    getEntitlements(ctx.workspace.id),
    getUsageSnapshot(ctx.workspace.id),
  ]);

  const aiLimit = entitlements.aiGenerationsPerMonth;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-ink-soft">Your account, workspace and plan.</p>
      </header>

      <div className="card p-6">
        <h3 className="font-semibold">Profile</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Name" value={ctx.user.name || "—"} />
          <Row label="Email" value={ctx.user.email} />
          <Row label="Role" value={ctx.role} />
        </dl>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold">Workspace</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Name" value={ctx.workspace.name} />
          <Row label="Slug" value={ctx.workspace.slug} />
          <Row label="Timezone" value={ctx.workspace.timezone} />
          <Row label="Currency" value={ctx.workspace.currency} />
        </dl>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Plan & usage</h3>
          <Badge>{sub?.plan?.name || "Free"}{sub ? ` · ${sub.status}` : ""}</Badge>
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="AI generations this month" value={`${usage.ai_generation}${aiLimit === null ? " (unlimited)" : ` / ${aiLimit}`}`} />
          <Row label="Lazy runs this month" value={String(usage.lazy_run)} />
          <Row label="Leads limit" value={entitlements.leads === null ? "Unlimited" : String(entitlements.leads)} />
          <Row label="Team members" value={entitlements.teamMembers === null ? "Unlimited" : String(entitlements.teamMembers)} />
        </dl>
        <p className="mt-3 text-xs text-muted">
          Billing/upgrades are behind a feature flag until Stripe is configured. See the README.
        </p>
      </div>

      <AccountDanger />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
