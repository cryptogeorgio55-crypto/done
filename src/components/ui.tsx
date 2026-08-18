import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "text-white bg-gradient-to-b from-brand to-brand-600 shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_8px_20px_-10px_rgba(0,147,146,0.7)] hover:from-brand hover:to-brand-700 hover:shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_12px_26px_-10px_rgba(0,147,146,0.8)]",
  secondary: "bg-white text-ink border border-line hover:border-line-strong hover:bg-surface",
  ghost: "text-ink-soft hover:bg-surface hover:text-ink",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : null}
      <span className={loading ? "opacity-80" : ""}>{children}</span>
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({
  className = "",
  hover = false,
  children,
  ...props
}: ComponentProps<"div"> & { hover?: boolean }) {
  return (
    <div className={`card ${hover ? "card-hover" : ""} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="h-hero text-ink">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-xl text-ink-soft">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const inputClasses =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted transition-colors focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClasses} ${props.className ?? ""}`} />;
}
export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputClasses} min-h-24 ${props.className ?? ""}`} />;
}
export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClasses} ${props.className ?? ""}`} />;
}

export function Alert({ kind = "error", children }: { kind?: "error" | "info"; children: ReactNode }) {
  const styles =
    kind === "error"
      ? "bg-red-50 text-red-700 border-red-100"
      : "bg-brand-50 text-brand border-brand-100";
  return (
    <div role="alert" className={`rounded-xl border px-3.5 py-2.5 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "amber" | "gray" | "green";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Premium, subtle status chip for content/campaign lifecycle. */
export function StatusChip({ status }: { status: string }) {
  const cls =
    {
      draft: "chip-draft",
      approved: "chip-approved",
      scheduled: "chip-scheduled",
      published: "chip-published",
      archived: "chip-archived",
      active: "chip-approved",
    }[status] || "chip-draft";
  return <span className={`chip ${cls}`}>{status}</span>;
}

/** Oversized outcome metric (analytics is outcome-based, not chart-heavy). */
export function Metric({
  value,
  label,
  hint,
}: {
  value: ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{value}</div>
      <div className="mt-1 text-sm font-medium text-ink-soft">{label}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand">
          {icon}
        </div>
      ) : null}
      <h3 className="text-xl font-semibold tracking-tight text-ink">{title}</h3>
      {body ? <p className="mt-1.5 max-w-sm text-ink-soft">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}
