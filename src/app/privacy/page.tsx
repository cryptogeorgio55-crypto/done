import Link from "next/link";
import { Wordmark } from "@/components/brand";

export const metadata = { title: "Privacy Policy — DONE" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Wordmark />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">
        This is a starting template. It has <strong>not</strong> been reviewed by a lawyer — replace
        it with a policy appropriate for your jurisdiction before going live.
      </p>
      <div className="prose mt-6 space-y-4 text-ink-soft">
        <section>
          <h2 className="text-lg font-semibold text-ink">What we store</h2>
          <p>Your account details, your Business Brain, and the content DONE generates for you.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink">How AI is used</h2>
          <p>
            When an AI provider is configured, your business context is sent to that provider to
            generate content. When no provider is configured, DONE runs in offline mode and no data
            leaves the server for generation.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink">Your controls</h2>
          <p>You can edit your Business Brain and delete your account and its data at any time from Settings.</p>
        </section>
      </div>
      <p className="mt-10 text-sm"><Link href="/" className="text-brand hover:underline">← Back home</Link></p>
    </div>
  );
}
