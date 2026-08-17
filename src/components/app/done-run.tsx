import { IconCheck, IconSparkle } from "@/components/icons";
import { Spinner } from "@/components/ui";

export type StepState = "done" | "active" | "pending";
export interface RunStep {
  label: string;
  state: StepState;
}

/**
 * DONE RUN — the reusable AI execution timeline. Instead of "Loading…",
 * DONE shows the real stages of work. Used by I'M LAZY and Autopilot.
 */
export function DoneRun({
  title = "I'm on it.",
  subtitle = "Give me a moment…",
  steps,
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  steps: RunStep[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "card overflow-hidden p-7"}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-cyan text-white">
          <IconSparkle className="h-5 w-5" />
        </span>
        <div>
          <p className="text-lg font-semibold text-ink">{title}</p>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      <ul className="mt-6 space-y-3">
        {steps.map((s) => (
          <DoneRunStep key={s.label} {...s} />
        ))}
      </ul>
    </div>
  );
}

export function DoneRunStep({ label, state }: RunStep) {
  const dim = state === "pending";
  return (
    <li className={`flex items-center gap-3 text-sm transition-opacity ${dim ? "opacity-40" : "opacity-100"}`}>
      <span
        className={`grid h-6 w-6 place-items-center rounded-full ${
          state === "done"
            ? "bg-emerald-100 text-emerald-600"
            : state === "active"
              ? "bg-blue-50 text-brand"
              : "bg-surface text-muted"
        }`}
      >
        {state === "done" ? (
          <IconCheck className="h-3.5 w-3.5" />
        ) : state === "active" ? (
          <Spinner className="h-3.5 w-3.5" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>
      <span className={dim ? "text-muted" : "text-ink"}>{label}</span>
    </li>
  );
}
