// Consistent thin-line icon set (24x24, currentColor, 1.7 stroke).
// One library, minimal weight — no emojis in the product chrome.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const IconToday = (p: P) => (
  <svg {...base(p)}><path d="M3 10.5 12 4l9 6.5" /><path d="M5 9.5V20h14V9.5" /><path d="M9.5 20v-5h5v5" /></svg>
);
export const IconCustomers = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 6.2a3 3 0 0 1 0 5.6" /><path d="M17.5 19a5.5 5.5 0 0 0-2.4-4.5" /></svg>
);
export const IconContent = (p: P) => (
  <svg {...base(p)}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>
);
export const IconReplies = (p: P) => (
  <svg {...base(p)}><path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z" /></svg>
);
export const IconLeads = (p: P) => (
  <svg {...base(p)}><path d="M12 21c-4.5-3-8-6-8-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 4-3.5 7-8 10z" opacity=".0" /><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
);
export const IconBrain = (p: P) => (
  <svg {...base(p)}><path d="M9 4.5A2.5 2.5 0 0 0 6.5 7 2.5 2.5 0 0 0 5 11a2.5 2.5 0 0 0 1.5 4A2.5 2.5 0 0 0 9 19.5c1 0 2-.7 2-2V6.5c0-1.3-1-2-2-2Z" /><path d="M15 4.5A2.5 2.5 0 0 1 17.5 7 2.5 2.5 0 0 1 19 11a2.5 2.5 0 0 1-1.5 4A2.5 2.5 0 0 1 15 19.5c-1 0-2-.7-2-2V6.5c0-1.3 1-2 2-2Z" /></svg>
);
export const IconAnalytics = (p: P) => (
  <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M4 20h16" /></svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9Z" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconSparkle = (p: P) => (
  <svg {...base(p)}><path d="M12 3l1.6 4.9L18.5 9.5 13.6 11 12 16l-1.6-5L5.5 9.5l4.9-1.6z" /><path d="M18.5 3.5v3M20 5h-3" /></svg>
);
export const IconChevron = (p: P) => (<svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>);
export const IconChevronsLeft = (p: P) => (<svg {...base(p)}><path d="m11 7-5 5 5 5M17 7l-5 5 5 5" /></svg>);
export const IconArrow = (p: P) => (<svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconCheck = (p: P) => (<svg {...base(p)}><path d="M5 12.5 10 17 19 7" /></svg>);
export const IconMenu = (p: P) => (<svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
export const IconX = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconLogout = (p: P) => (
  <svg {...base(p)}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 12h10M17 9l3 3-3 3" /></svg>
);
export const IconBolt = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props(p)}><path d="M13 2 4.5 13.2c-.4.5 0 1.3.7 1.3H11l-1 8 8.8-11.5c.4-.5 0-1.3-.7-1.3H12l1-8Z" /></svg>
);
function props(p: P) { return p; }

export const IconInbox = (p: P) => (
  <svg {...base(p)}><path d="M4 13l2.5-7A2 2 0 0 1 8.4 4.7h7.2a2 2 0 0 1 1.9 1.3L20 13" /><path d="M4 13h4a2 2 0 0 1 2 2 2 2 0 0 0 4 0 2 2 0 0 1 2-2h4v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /></svg>
);
export const IconApprovals = (p: P) => (
  <svg {...base(p)}><path d="M9 11l2.5 2.5L16 8" /><rect x="4" y="4" width="16" height="16" rx="3" /></svg>
);
export const IconAutopilot = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" /><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" /></svg>
);
export const IconPlug = (p: P) => (
  <svg {...base(p)}><path d="M9 3v5M15 3v5" /><path d="M7 8h10v3a5 5 0 0 1-10 0z" /><path d="M12 16v5" /></svg>
);
export const IconActivity = (p: P) => (
  <svg {...base(p)}><path d="M3 12h4l2.5 7 5-14L17 12h4" /></svg>
);
export const IconPause = (p: P) => (<svg {...base(p)}><path d="M8 5v14M16 5v14" /></svg>);
