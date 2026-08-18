import type { Agent, AgentId } from "./types";
import { executiveAgent } from "./executive";
import { salesAgent } from "./sales";
import { customerAgent } from "./customer";
import { calendarAgent } from "./calendar";
import { marketingAgent } from "./marketing";
import { operationsAgent } from "./operations";

/** The registered agent roster. Order is display order in Mission Control. */
export const AGENTS: Agent[] = [
  executiveAgent,
  salesAgent,
  customerAgent,
  calendarAgent,
  marketingAgent,
  operationsAgent,
];

export function getAgent(id: AgentId): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}
