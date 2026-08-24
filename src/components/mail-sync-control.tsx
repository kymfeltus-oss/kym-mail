"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMailTimestamp } from "@/lib/mail/date-format";

type State = "idle" | "syncing" | "complete" | "error";

export function MailSyncControl({ connected, initialSyncComplete, lastSyncedAt }: { connected: boolean; initialSyncComplete: boolean; lastSyncedAt: string | null }) {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  const synchronize = useCallback(async () => {
    setState("syncing"); setError(null);
    try {
      const response = await fetch("/api/mail/sync", { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Mailbox synchronization could not be completed.");
      setState("complete"); router.refresh();
    } catch (cause) {
      setState("error"); setError(cause instanceof Error ? cause.message : "Mailbox synchronization could not be completed.");
    }
  }, [router]);

  useEffect(() => {
    if (connected && !started.current) {
      started.current = true;
      void synchronize();
    }
  }, [connected, initialSyncComplete, synchronize]);

  if (!connected) return null;
  return <div className="mt-5 flex flex-wrap items-center gap-3">
    <button type="button" onClick={() => void synchronize()} disabled={state === "syncing"} className="rounded-full border border-[#D95B72] px-4 py-2 text-xs font-semibold text-[#A73D52] transition hover:bg-[#FFF3F4] disabled:cursor-wait disabled:opacity-60">
      {state === "syncing" ? "Synchronizing…" : initialSyncComplete ? "Sync now" : "Start mailbox sync"}
    </button>
    <p className="text-xs text-[#64748B]">
      {state === "syncing" ? "Retrieving real Gmail messages…" : state === "complete" ? "Mailbox synchronized." : lastSyncedAt ? `Last synchronized ${formatMailTimestamp(lastSyncedAt)}` : "Mailbox has not synchronized yet."}
    </p>
    {error && <p role="alert" className="w-full text-xs text-[#A73D52]">{error}</p>}
  </div>;
}
