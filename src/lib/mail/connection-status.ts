export type GoogleMailConnection = {
  connection_state: string;
  provider_account_id: string | null;
  sync_error: string | null;
  last_synced_at: string | null;
  initial_sync_completed_at: string | null;
} | null;

const oauthErrorCopy: Record<string, string> = {
  authorization_denied: "Google authorization was not completed. Start the connection again to restore mail.",
  connection_create: "A Google Mail connection could not be created. Try connecting again.",
  connection_lookup: "The Google Mail connection could not be loaded. Try connecting again.",
  connection_storage: "Google Mail authorization could not be stored. Start the connection again.",
  credential_storage: "Google Mail credentials could not be stored. Start the connection again.",
  invalid_oauth_state: "Google authorization could not be verified. Start the connection again.",
  missing_refresh_token: "Google did not return a reusable authorization. Start the connection again.",
  oauth_callback: "Google did not return an authorization code. Start the connection again.",
  oauth_exchange: "Google authorization failed. Start the connection again.",
  profile_lookup: "The Gmail profile could not be loaded. Reconnect Google Mail.",
  send_as_lookup: "Verified Gmail senders could not be loaded. Reconnect Google Mail.",
  watch_setup: "Gmail notifications could not be activated. Reconnect Google Mail to finish setup."
};

export function googleMailNeedsReconnect(connection: GoogleMailConnection) {
  if (!connection) return true;
  if (connection.connection_state !== "connected") return true;
  return Boolean(connection.sync_error?.trim());
}

export function googleMailActionLabel(connection: GoogleMailConnection) {
  if (!connection) return "Connect Google Mail";
  if (connection.connection_state === "disconnected" && !connection.provider_account_id) return "Connect Google Mail";
  return "Reconnect Google Mail";
}

export function googleMailHeadline(connection: GoogleMailConnection) {
  if (!connection || (connection.connection_state === "disconnected" && !connection.provider_account_id)) return "Connect Google Mail";
  if (connection.connection_state === "reauth_required") return "Reconnect Google Mail";
  if (connection.connection_state === "error") return "Google Mail needs attention";
  if (connection.connection_state === "connecting") return "Finish Google Mail connection";
  if (connection.sync_error) return "Google Mail is offline";
  return "Connect Google Mail";
}

export function googleMailBody(connection: GoogleMailConnection) {
  if (!connection || (connection.connection_state === "disconnected" && !connection.provider_account_id)) {
    return "Authorize the private Gmail provider to synchronize and send through your verified KYM Mail identities.";
  }
  if (connection.connection_state === "reauth_required") return "Google authorization is no longer usable. Reconnect securely to resume synchronization and sending.";
  if (connection.connection_state === "error") return "The provider connection could not be used. Reconnect Google Mail to recover safely.";
  if (connection.connection_state === "connecting") return "Google authorization was started but not finished. Reconnect to complete setup.";
  if (connection.sync_error) return "Gmail is not usable right now. Reconnect to restore synchronization and sending.";
  return "Authorize the private Gmail provider to synchronize and send through your verified KYM Mail identities.";
}

export function googleMailOauthMessage(error?: string, connected = false) {
  if (connected) return "Google Mail is connected. Synchronization and sending can resume.";
  if (!error) return null;
  return oauthErrorCopy[error] ?? "Google Mail could not be connected. Start the connection again.";
}
