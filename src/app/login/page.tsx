import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="bg-aurora grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center"><Wordmark /></div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-ink-soft">Sign in to pick up where you left off.</p>
        </div>
        <div className="card p-6 sm:p-8">
          <AuthForm mode="login" />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          New to DONE?{" "}
          <Link href="/signup" className="font-medium text-brand hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
