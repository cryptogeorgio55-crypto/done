"use client";

import { useState } from "react";
import { api, ClientApiError } from "@/lib/client";
import { Button, Textarea, Select, Alert, Field, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { BoltIcon } from "@/components/brand";

const MODES = [
  ["friendly", "Friendly"],
  ["professional", "Professional"],
  ["short", "Short"],
  ["sales", "Sales-focused"],
  ["objection", "Handle objection"],
  ["complaint", "Complaint"],
  ["price", "Price inquiry"],
  ["availability", "Availability"],
  ["booking", "Booking"],
  ["followup", "Follow-up"],
];

export default function RepliesPage() {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("friendly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  async function run() {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ reply: { reply: string }; offline: boolean }>("/api/replies", {
        method: "POST",
        body: { message, mode },
      });
      setReply(data.reply.reply);
      setOffline(data.offline);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't generate a reply. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Replies" title="Paste it. I'll answer." subtitle="Drop in a customer message and DONE writes the reply — in your voice, no prompting." />

      <div className="card space-y-4 p-6">
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Customer message" htmlFor="msg">
          <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi, how much is a gel manicure and do you have anything this Saturday?" className="min-h-28" />
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Reply style" htmlFor="mode">
            <Select id="mode" value={mode} onChange={(e) => setMode(e.target.value)} className="sm:w-56">
              {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Button onClick={run} disabled={loading || !message.trim()} className="sm:ml-auto">
            <BoltIcon className="h-4 w-4" /> {loading ? "Writing…" : "Write reply"}
          </Button>
        </div>
      </div>

      {reply ? (
        <div className="card p-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">Suggested reply</span>
            <div className="flex items-center gap-2">
              {offline ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">offline mode</span> : null}
              <CopyButton text={reply} />
            </div>
          </div>
          <p className="whitespace-pre-wrap text-sm text-ink">{reply}</p>
        </div>
      ) : null}
    </div>
  );
}
