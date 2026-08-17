import type { CSSProperties } from "react";

export type PulseState = "calm" | "active" | "attention" | "opportunity";

export const PULSE_COPY: Record<PulseState, { label: string; sub: string }> = {
  calm: { label: "All clear", sub: "Everything is under control." },
  active: { label: "Working", sub: "DONE is handling things right now." },
  attention: { label: "Needs you", sub: "Something needs your call." },
  opportunity: { label: "Opportunity", sub: "DONE found something worth doing." },
};

/**
 * DONE PULSE — the signature visual for the current business state.
 * Pure CSS/SVG (no runtime deps), honours prefers-reduced-motion, and
 * changes colour + rhythm based on the real system state passed in.
 */
export function DonePulse({
  state = "calm",
  size = 168,
  className = "",
}: {
  state?: PulseState;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`done-pulse ${className}`}
      data-state={state}
      style={{ ["--pulse-size" as keyof CSSProperties]: `${size}px` } as CSSProperties}
      role="img"
      aria-label={`Business state: ${PULSE_COPY[state].label}. ${PULSE_COPY[state].sub}`}
    >
      <span className="done-pulse__halo" aria-hidden />
      <span className="done-pulse__ring" aria-hidden />
      <span className="done-pulse__ring done-pulse__ring--2" aria-hidden />
      <span className="done-pulse__core" aria-hidden />
    </div>
  );
}
