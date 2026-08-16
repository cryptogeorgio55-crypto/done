import Link from "next/link";
import { Wordmark } from "@/components/brand";

export const metadata = { title: "Terms of Service — DONE" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Wordmark />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">
        This is a starting template. It has <strong>not</strong> been reviewed by a lawyer — replace
        it with terms appropriate for your business before going live.
      </p>
      <div className="mt-6 space-y-4 text-ink-soft">
        <section>
          <h2 className="text-lg font-semibold text-ink">Using DONE</h2>
          <p>DONE helps you create marketing content. You are responsible for reviewing everything before you publish or send it.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink">AI-generated content</h2>
          <p>AI output can contain mistakes. Always check facts, prices and claims against your actual business before use.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink">Accounts</h2>
          <p>Keep your password secure. You can close your account at any time from Settings.</p>
        </section>
      </div>
      <p className="mt-10 text-sm"><Link href="/" className="text-brand hover:underline">← Back home</Link></p>
    </div>
  );
}
