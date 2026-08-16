import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await requireWorkspaceContext();
  // Force onboarding until the Business Brain is set up.
  if (!ctx.workspace.onboardedAt) redirect("/onboarding");

  return (
    <div className="min-h-screen lg:flex">
      <AppNav workspaceName={ctx.workspace.name} isAdmin={user.isPlatformAdmin} />
      <main className="flex-1 bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
