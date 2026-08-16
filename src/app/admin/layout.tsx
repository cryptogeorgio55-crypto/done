import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Wordmark } from "@/components/brand";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Platform admin is distinct from workspace roles — enforced server-side.
  if (!user.isPlatformAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Wordmark href="/admin" />
            <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-white">ADMIN</span>
          </div>
          <Link href="/dashboard" className="text-sm text-ink-soft hover:text-ink">← Back to app</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
