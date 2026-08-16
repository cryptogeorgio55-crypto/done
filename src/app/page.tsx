import { Wordmark, BoltIcon, ArrowIcon } from "@/components/brand";
import { ButtonLink, Badge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getCurrentUser();
  const primaryHref = user ? "/dashboard" : "/signup";

  return (
    <div className="bg-aurora min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
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
      <section className="mx-auto max-w-6xl px-6 pb-8 pt-12 text-center sm:pt-20">
        <div className="mx-auto max-w-3xl">
          <Badge>Less prompting. More DONE.</Badge>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            Your business.
            <br />
            <span className="bg-gradient-to-r from-brand to-cyan bg-clip-text text-transparent">DONE.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft">
            Tell DONE what your business does once. Then it writes your content, offers, replies and
            follow-ups for you — no complicated AI prompting required.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href={primaryHref} variant="primary" className="px-6 py-3 text-base">
              <BoltIcon className="h-4 w-4" /> Start free
            </ButtonLink>
            <ButtonLink href="#how" variant="secondary" className="px-6 py-3 text-base">
              How it works <ArrowIcon className="h-4 w-4" />
            </ButtonLink>
          </div>

          {/* I'M LAZY showcase */}
          <div className="mx-auto mt-14 max-w-md">
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted">JUST PRESS</p>
            <div className="card flex items-center justify-between gap-3 bg-gradient-to-br from-brand to-cyan px-6 py-5 text-white">
              <BoltIcon className="h-6 w-6" />
              <span className="text-2xl font-semibold tracking-tight">I&apos;M LAZY</span>
              <ArrowIcon className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm text-muted">
              DONE looks at your business and does the single highest-value thing for you.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["1", "Tell DONE about your business", "A short onboarding builds your Business Brain."],
            ["2", "DONE learns your brand", "Your products, tone, customers and goals — remembered."],
            ["3", "Press I'M LAZY or choose", "Pick what you need, or let DONE decide."],
            ["4", "DONE creates the work", "Campaigns, posts, replies and plans — ready to use."],
          ].map(([n, title, body]) => (
            <div key={n} className="card p-6">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-sm font-semibold text-brand">
                {n}
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Content", "Posts, captions, Reels and Stories tailored to your brand."],
            ["Get customers", "Full acquisition campaigns with every asset you need."],
            ["Offers", "Promotions built from what you actually sell."],
            ["Replies", "Paste a customer message, get the perfect reply."],
            ["Follow-ups", "Never forget a lead — DONE nudges you and drafts the message."],
            ["Plan my week", "A realistic weekly plan a busy owner can actually do."],
          ].map(([title, body]) => (
            <div key={title} className="card p-6">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line">
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
