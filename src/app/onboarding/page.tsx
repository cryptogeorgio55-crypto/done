import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceContext } from "@/lib/workspace/context";
import { Wordmark } from "@/components/brand";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default async function OnboardingPage() {
  if (!(await getCurrentUser())) redirect("/login");
  const ctx = await requireWorkspaceContext();
  if (ctx.workspace.onboardedAt) redirect("/dashboard");

  return (
    <div className="bg-aurora grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center"><Wordmark /></div>
          <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your Business Brain</h1>
          <p className="mt-2 text-ink-soft">Answer a few quick questions. You can change anything later.</p>
        </div>
        <div className="flex justify-center">
          <OnboardingWizard initialName={ctx.workspace.name} />
        </div>
      </div>
    </div>
  );
}
