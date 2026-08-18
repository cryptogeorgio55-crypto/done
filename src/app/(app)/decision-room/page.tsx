import { requireWorkspaceContext } from "@/lib/workspace/context";
import { DecisionRoomClient } from "./decision-room-client";

export const metadata = { title: "Decision Room — DONE" };

export default async function DecisionRoomPage() {
  // Auth / workspace gate (mirrors the rest of the app group).
  await requireWorkspaceContext();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display">Decision Room</h1>
        <p className="mt-2 max-w-xl text-lg text-ink-soft">
          Bring me a business decision. I&apos;ll weigh it against what I know about your business —
          products, pricing, policies and your own rules — and recommend a concrete move.
        </p>
      </header>
      <DecisionRoomClient />
    </div>
  );
}
