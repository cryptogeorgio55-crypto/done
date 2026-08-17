// The standardized connector architecture. Every integration exposes the same
// shape so the AI/orchestrator call *normalized capabilities* — never
// provider-specific code. Adding a provider means implementing this interface,
// not touching the orchestrator.

import type { WorkspaceContext } from "@/lib/workspace/context";
import type { NormalizedEvent } from "@/lib/events/types";

/** Normalized capability identifiers the AI tools map onto. */
export type Capability =
  | "gmail.search_messages"
  | "gmail.read_thread"
  | "gmail.create_draft"
  | "gmail.send_message"
  | "gmail.label_message"
  | "calendar.read_events"
  | "calendar.check_availability"
  | "calendar.create_event"
  | "calendar.update_event"
  | "drive.search_files"
  | "drive.read_file";

export type ProviderKey =
  | "gmail"
  | "google_calendar"
  | "google_drive"
  | "outlook"
  | "outlook_calendar"
  | "whatsapp"
  | "slack"
  | "teams"
  | "onedrive"
  | "dropbox"
  | "shopify"
  | "woocommerce"
  | "hubspot"
  | "salesforce"
  | "stripe"
  | "meta"
  | "instagram"
  | "google_ads"
  | "google_business"
  | "google_sheets"
  | "notion"
  | "airtable";

export type ConnectorCategory =
  | "communication"
  | "calendar"
  | "files"
  | "business"
  | "marketing"
  | "productivity";

export type Phase = 1 | 2 | 3 | 4;

/** Static catalog metadata — safe to expose to the frontend. */
export interface ConnectorMeta {
  key: ProviderKey;
  name: string;
  category: ConnectorCategory;
  phase: Phase;
  description: string;
  /** Human-readable permission scopes shown before connecting (least privilege). */
  permissions: string[];
  capabilities: Capability[];
  /** Whether a working implementation exists (vs. catalog-only placeholder). */
  implemented: boolean;
  /** Whether real OAuth is wired (else sandbox/simulated mode is offered). */
  oauth: boolean;
}

export interface CapabilityCallContext {
  ctx: WorkspaceContext;
  accountId: string;
  /** Non-secret account config. */
  config: Record<string, unknown>;
}

/** The live behaviour of a connector, resolved against a connected account. */
export interface Connector extends ConnectorMeta {
  /** Poll the provider (or sandbox) and return newly observed normalized events. */
  poll(cc: CapabilityCallContext): Promise<NormalizedEvent[]>;
  /** Report connection health. */
  health(cc: CapabilityCallContext): Promise<{ status: "ok" | "degraded" | "down"; detail?: string }>;
  /** Invoke a normalized capability. Input/output are capability-specific. */
  invoke(cc: CapabilityCallContext, capability: Capability, input: unknown): Promise<unknown>;
}
