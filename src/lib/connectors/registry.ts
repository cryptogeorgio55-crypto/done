import type { Connector, ConnectorMeta, ProviderKey } from "./types";
import { gmailConnector } from "./gmail";
import { calendarConnector } from "./calendar";

// Live connectors — those with a working implementation. The catalog below also
// advertises providers that are architecturally supported but not yet built, so
// the UI can show the full roadmap WITHOUT ever letting a user "connect" to a
// provider that isn't real.

const LIVE: Partial<Record<ProviderKey, Connector>> = {
  gmail: gmailConnector,
  google_calendar: calendarConnector,
};

/** Catalog-only metadata for providers we advertise but haven't implemented. */
const CATALOG: ConnectorMeta[] = [
  {
    key: "google_drive",
    name: "Google Drive",
    category: "files",
    phase: 2,
    description: "Let DONE learn from approved documents — pricing, policies, FAQs.",
    permissions: ["Read files in folders you choose"],
    capabilities: ["drive.search_files", "drive.read_file"],
    implemented: false,
    oauth: true,
  },
  { key: "outlook", name: "Outlook", category: "communication", phase: 2, description: "Email via Microsoft 365.", permissions: ["Read and send mail"], capabilities: [], implemented: false, oauth: true },
  { key: "whatsapp", name: "WhatsApp Business", category: "communication", phase: 3, description: "Reply to customers on WhatsApp.", permissions: ["Read and send messages"], capabilities: [], implemented: false, oauth: true },
  { key: "slack", name: "Slack", category: "communication", phase: 3, description: "Notifications and team updates.", permissions: ["Post messages"], capabilities: [], implemented: false, oauth: true },
  { key: "teams", name: "Microsoft Teams", category: "communication", phase: 3, description: "Notifications and updates.", permissions: ["Post messages"], capabilities: [], implemented: false, oauth: true },
  { key: "hubspot", name: "HubSpot", category: "business", phase: 3, description: "Sync leads and contacts.", permissions: ["Read and write CRM records"], capabilities: [], implemented: false, oauth: true },
  { key: "salesforce", name: "Salesforce", category: "business", phase: 3, description: "Sync leads and opportunities.", permissions: ["Read and write CRM records"], capabilities: [], implemented: false, oauth: true },
  { key: "stripe", name: "Stripe", category: "business", phase: 3, description: "See payments and failed charges.", permissions: ["Read payment events"], capabilities: [], implemented: false, oauth: true },
  { key: "shopify", name: "Shopify", category: "business", phase: 4, description: "See orders and customers.", permissions: ["Read orders"], capabilities: [], implemented: false, oauth: true },
  { key: "woocommerce", name: "WooCommerce", category: "business", phase: 4, description: "See orders and customers.", permissions: ["Read orders"], capabilities: [], implemented: false, oauth: true },
  { key: "meta", name: "Meta", category: "marketing", phase: 4, description: "Manage Facebook & Instagram.", permissions: ["Manage pages and ads"], capabilities: [], implemented: false, oauth: true },
  { key: "instagram", name: "Instagram", category: "marketing", phase: 4, description: "Reply to DMs and comments.", permissions: ["Read and send messages"], capabilities: [], implemented: false, oauth: true },
  { key: "google_ads", name: "Google Ads", category: "marketing", phase: 4, description: "See ad performance.", permissions: ["Read campaigns"], capabilities: [], implemented: false, oauth: true },
  { key: "google_business", name: "Google Business Profile", category: "marketing", phase: 4, description: "Manage reviews and posts.", permissions: ["Read and reply to reviews"], capabilities: [], implemented: false, oauth: true },
  { key: "google_sheets", name: "Google Sheets", category: "productivity", phase: 4, description: "Read and write spreadsheets.", permissions: ["Read and write sheets"], capabilities: [], implemented: false, oauth: true },
  { key: "notion", name: "Notion", category: "productivity", phase: 4, description: "Read and write pages.", permissions: ["Read and write pages"], capabilities: [], implemented: false, oauth: true },
  { key: "airtable", name: "Airtable", category: "productivity", phase: 4, description: "Read and write bases.", permissions: ["Read and write records"], capabilities: [], implemented: false, oauth: true },
];

function metaOf(c: Connector): ConnectorMeta {
  const { poll: _p, health: _h, invoke: _i, ...meta } = c;
  void _p; void _h; void _i;
  return meta;
}

/** All providers (implemented + catalog), for the Connections page. */
export function listConnectorCatalog(): ConnectorMeta[] {
  const live = Object.values(LIVE).map((c) => metaOf(c!));
  return [...live, ...CATALOG];
}

/** Get a live connector implementation, if one exists. */
export function getConnector(provider: string): Connector | null {
  return (LIVE as Record<string, Connector | undefined>)[provider] ?? null;
}

export function isImplemented(provider: string): boolean {
  return provider in LIVE;
}
