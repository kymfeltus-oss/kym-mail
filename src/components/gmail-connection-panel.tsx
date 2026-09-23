import Link from "next/link";
import { MailSyncControl } from "@/components/mail-sync-control";
import {
  googleMailActionLabel,
  googleMailBody,
  googleMailHeadline,
  googleMailNeedsReconnect,
  type GoogleMailConnection
} from "@/lib/mail/connection-status";

export function GmailConnectionPanel({
  connection,
  availableIdentityCount,
  oauthMessage
}: {
  connection: GoogleMailConnection;
  availableIdentityCount: number;
  oauthMessage?: string | null;
}) {
  const needsReconnect = googleMailNeedsReconnect(connection);
  const actionLabel = googleMailActionLabel(connection);
  const reconnectHref = "/api/oauth/google/start";

  if (needsReconnect) {
    return <section className="glass my-7 rounded-3xl p-6 sm:p-8">
      {oauthMessage && <p role="status" className="mb-4 rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] px-4 py-3 text-sm font-semibold text-[#A73D52]">{oauthMessage}</p>}
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h2 className="text-xl font-semibold text-[#183A5A]">{googleMailHeadline(connection)}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#64748B]">{googleMailBody(connection)}</p>
          {connection?.provider_account_id && <p className="mt-2 text-xs text-[#64748B]">Last connected account: {connection.provider_account_id}</p>}
          {connection?.sync_error && <p className="mt-2 text-sm text-[#A73D52]">{connection.sync_error}</p>}
        </div>
        <Link href={reconnectHref} className="rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(217,91,114,.22)] transition hover:bg-[#C94C64]">{actionLabel}</Link>
      </div>
      {connection?.connection_state === "connected" && <MailSyncControl connected autoStart={false} initialSyncComplete={Boolean(connection.initial_sync_completed_at)} lastSyncedAt={connection.last_synced_at ?? null} />}
    </section>;
  }

  return <details className="my-7 rounded-2xl border border-[#E8E2E3] bg-[#FFFCFB] px-5 py-4">
    {oauthMessage && <p role="status" className="mb-3 rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] px-4 py-3 text-sm font-semibold text-[#A73D52]">{oauthMessage}</p>}
    <summary className="cursor-pointer text-sm font-semibold text-[#183A5A]">Google Mail connected · {availableIdentityCount} verified sender{availableIdentityCount === 1 ? "" : "s"}</summary>
    <p className="mt-3 text-xs text-[#64748B]">Provider account: {connection?.provider_account_id}</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Link href={reconnectHref} className="rounded-full border border-[#D95B72] px-4 py-2 text-xs font-semibold text-[#A73D52] transition hover:bg-[#FFF3F4]">{actionLabel}</Link>
      <p className="text-xs text-[#64748B]">Use this if Gmail goes offline or Google asks you to sign in again.</p>
    </div>
    <MailSyncControl connected initialSyncComplete={Boolean(connection?.initial_sync_completed_at)} lastSyncedAt={connection?.last_synced_at ?? null} />
  </details>;
}
