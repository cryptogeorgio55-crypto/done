import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="bg-aurora grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center"><Wordmark /></div>
          <h1 className="text-3xl font-semibold tracking-tight">Start with DONE</h1>
          <p className="mt-2 text-ink-soft">Create your account. It takes about a minute.</p>
        </div>
        <div className="card p-6 sm:p-8">
          <AuthForm mode="signup" />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
