import { Wordmark, BoltIcon } from "@/components/brand";
import { ButtonLink } from "@/components/ui";
import { IconArrow, IconCheck, IconSparkle } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getCurrentUser();
  const primaryHref = user ? "/dashboard" : "/signup";

  return (
    <div className="bg-aurora bg-grid relative min-h-screen overflow-hidden">
      <div className="orb -left-20 top-10 h-72 w-72 bg-brand/20" />
      <div className="orb right-0 top-0 h-80 w-80 bg-cyan/20" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark />
        <nav className="flex items-center gap-2">
          {user ? (
            <ButtonLink href="/dashboard" variant="secondary">Open app</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
              <ButtonLink href="/signup" variant="primary">Get started</ButtonLink>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:pt-16">
        <div className="animate-slide-up">
          <p className="eyebrow">The AI operating system for your business</p>
          <h1 className="display mt-4">
            Half your work.
            <br />
            Already <span className="text-gradient">DONE.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-ink-soft">
            Connect your inbox, calendar, customers and business. DONE watches what happens, handles
            the routine work, and brings you in only when it matters.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={primaryHref} variant="primary" size="lg">
              <BoltIcon className="h-4 w-4" /> Try DONE
            </ButtonLink>
            <ButtonLink href="#how" variant="secondary" size="lg">
              See how it works <IconArrow className="h-4 w-4" />
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-muted">No credit card needed · Works offline with zero setup</p>
        </div>

        {/* Product demo mock — watch → understand → handle */}
        <div className="animate-slide-up-lg">
          <div className="glass rounded-3xl p-4 shadow-[0_40px_100px_-40px_rgba(37,99,235,0.5)]">
            <div className="rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Live</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> DONE active
                </span>
              </div>
              <ol className="mt-3 space-y-3">
                {[
                  ["New email from Sarah", "Website pricing inquiry · Gmail"],
                  ["DONE understood it", "High-intent lead — created & tagged"],
                  ["Reply sent", "Answered her timeline question"],
                  ["Follow-up scheduled", "Thursday, if she doesn't reply"],
                ].map(([title, sub], i) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600"><IconCheck className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{title}</span>
                      <span className="block text-xs text-muted">{sub}</span>
                    </span>
                    <span className="ml-auto text-[11px] tabular-nums text-muted">{`11:4${i}`}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 rounded-2xl border border-line bg-surface/60 p-4 text-center">
                <span className="text-lg font-semibold tracking-tight text-ink">DONE.</span>
                <p className="mt-0.5 text-xs text-ink-soft">You did nothing. It&apos;s already handled.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* While you sleep */}
      <section className="relative mx-auto max-w-4xl px-6 py-20">
        <div className="text-center">
          <h2 className="h-hero">Your business doesn&apos;t stop when you close the laptop.</h2>
          <p className="mx-auto mt-3 max-w-lg text-ink-soft">Neither does DONE. Here&apos;s a night while you were asleep.</p>
        </div>
        <ol className="mx-auto mt-10 max-w-xl space-y-4">
          {[
            ["11:43 PM", "New lead", "Someone asked about your services on Instagram."],
            ["11:44 PM", "DONE responded", "Answered instantly, in your brand voice."],
            ["11:45 PM", "Lead created", "Tagged high-intent, follow-up scheduled."],
            ["8:00 AM", "You open DONE", "Everything is handled."],
          ].map(([time, title, body], i, arr) => (
            <li key={title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className={`h-3 w-3 rounded-full ${i === arr.length - 1 ? "bg-brand" : "bg-line-strong"}`} />
                {i < arr.length - 1 ? <span className="mt-1 w-px flex-1 bg-line" /> : null}
              </div>
              <div className="pb-2">
                <span className="text-xs font-semibold tabular-nums text-muted">{time}</span>
                <p className="font-semibold text-ink">{title}</p>
                <p className="text-sm text-ink-soft">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Problem storytelling */}
      <section className="relative mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="h-hero">Running a business already takes enough.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {["What should I post?", "Who should I follow up with?", "What offer should I run?", "How do I reply to this?"].map((q) => (
            <span key={q} className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink-soft">{q}</span>
          ))}
        </div>
        <p className="mt-10 display text-gradient">DONE.</p>
      </section>

      {/* One button */}
      <section id="how" className="relative mx-auto max-w-5xl px-6 py-16">
        <div className="card overflow-hidden p-8 text-center sm:p-12">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-cyan text-white"><IconSparkle className="h-6 w-6" /></span>
          <h2 className="h-hero mt-5">One button. An unfair amount of work done.</h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-soft">
            DONE looks at your business, decides what deserves attention, and creates the work —
            campaigns, posts, replies and plans.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="relative mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["1", "Tell DONE about your business", "A short onboarding builds your Business Brain."],
            ["2", "DONE learns your brand", "Products, tone, customers and goals — remembered."],
            ["3", "Press I'M LAZY or choose", "Pick what you need, or let DONE decide."],
            ["4", "DONE creates the work", "Campaigns, posts, replies and plans — ready to use."],
          ].map(([n, title, body]) => (
            <div key={n} className="card card-hover p-6">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-sm font-semibold text-brand">{n}</div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Get customers.", "Full acquisition campaigns with every asset you need."],
            ["Never wonder what to post.", "A content studio that writes in your voice."],
            ["Never forget the follow-up.", "DONE nudges you and drafts the message."],
            ["Reply in seconds.", "Paste a customer message, get the perfect answer."],
            ["Plan your week.", "A realistic plan a busy owner can actually do."],
            ["DONE knows your business.", "One Business Brain powering everything."],
          ].map(([title, body]) => (
            <div key={title} className="card card-hover p-6">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl px-8 py-14 text-center text-white" style={{ background: "linear-gradient(120deg,#1d4ed8,#2563eb 45%,#06b6d4)" }}>
          <h2 className="h-hero">Let DONE take it from here.</h2>
          <p className="mx-auto mt-3 max-w-md text-white/85">Set up your business once. Then just press the button.</p>
          <div className="mt-7 flex justify-center">
            <ButtonLink href={primaryHref} variant="secondary" size="lg" className="!text-ink">Start free <IconArrow className="h-4 w-4" /></ButtonLink>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-line bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted sm:flex-row">
          <Wordmark />
          <div className="flex gap-5">
            <a href="/privacy" className="hover:text-ink">Privacy</a>
            <a href="/terms" className="hover:text-ink">Terms</a>
          </div>
          <span>© {new Date().getFullYear()} DONE</span>
        </div>
      </footer>
    </div>
  );
}
