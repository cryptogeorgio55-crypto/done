import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2" aria-label="DONE home">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand to-cyan text-white shadow-sm">
        <BoltIcon className="h-4 w-4" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-ink">DONE</span>
    </Link>
  );
}

export function BoltIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13 2 4.5 13.2c-.4.5 0 1.3.7 1.3H11l-1 8 8.8-11.5c.4-.5 0-1.3-.7-1.3H12l1-8Z" />
    </svg>
  );
}

export function ArrowIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
