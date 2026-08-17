import { db } from "@/lib/db";

/** The AI employee's operating manual — explicit rules the owner has set. */
export async function listOperatingRules(workspaceId: string) {
  return db.operatingRule.findMany({
    where: { workspaceId, active: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Render operating rules as a compact instruction block for prompts. */
export async function renderOperatingRules(workspaceId: string): Promise<string> {
  const rules = await listOperatingRules(workspaceId);
  if (!rules.length) return "";
  const lines = rules.map((r) => `- (${r.category}) ${r.rule}`);
  return ["OWNER OPERATING RULES (always follow):", ...lines].join("\n");
}
