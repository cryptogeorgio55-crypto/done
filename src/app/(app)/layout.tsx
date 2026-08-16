import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { AppChrome } from "@/components/app/app-chrome";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await requireWorkspaceContext();
  // Force onboarding until the Business Brain is set up.
  if (!ctx.workspace.onboardedAt) redirect("/onboarding");

  return (
    <AppChrome
      workspaceName={ctx.workspace.name}
      userName={user.name || ""}
      userEmail={user.email}
      isAdmin={user.isPlatformAdmin}
    >
      {children}
    </AppChrome>
  );
}
