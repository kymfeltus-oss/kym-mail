import { describe, expect, it } from "vitest";
import {
  googleMailActionLabel,
  googleMailHeadline,
  googleMailNeedsReconnect,
  googleMailOauthMessage
} from "./connection-status";

const connected = {
  connection_state: "connected",
  provider_account_id: "kymfeltus@gmail.com",
  sync_error: null,
  last_synced_at: "2026-09-14T00:00:00.000Z",
  initial_sync_completed_at: "2026-08-24T00:00:00.000Z"
};

describe("Google Mail connection status", () => {
  it("requires reconnect when Gmail is marked connected but offline with a sync error", () => {
    expect(googleMailNeedsReconnect({ ...connected, sync_error: "Google Mail is temporarily unavailable." })).toBe(true);
    expect(googleMailHeadline({ ...connected, sync_error: "Google Mail is temporarily unavailable." })).toBe("Google Mail is offline");
    expect(googleMailActionLabel({ ...connected, sync_error: "Google Mail is temporarily unavailable." })).toBe("Reconnect Google Mail");
  });

  it("requires reconnect for authorization, error, and unfinished states", () => {
    expect(googleMailNeedsReconnect({ ...connected, connection_state: "reauth_required" })).toBe(true);
    expect(googleMailNeedsReconnect({ ...connected, connection_state: "error" })).toBe(true);
    expect(googleMailNeedsReconnect({ ...connected, connection_state: "disconnected" })).toBe(true);
    expect(googleMailNeedsReconnect({ ...connected, connection_state: "connecting" })).toBe(true);
    expect(googleMailNeedsReconnect(null)).toBe(true);
  });

  it("does not treat a healthy connected mailbox as needing reconnect", () => {
    expect(googleMailNeedsReconnect(connected)).toBe(false);
  });

  it("uses connect copy only before a Google account has been linked", () => {
    expect(googleMailActionLabel(null)).toBe("Connect Google Mail");
    expect(googleMailActionLabel({ ...connected, connection_state: "disconnected", provider_account_id: null })).toBe("Connect Google Mail");
    expect(googleMailActionLabel({ ...connected, connection_state: "disconnected" })).toBe("Reconnect Google Mail");
  });

  it("maps OAuth result query parameters to owner-facing copy", () => {
    expect(googleMailOauthMessage(undefined, true)).toContain("Google Mail is connected");
    expect(googleMailOauthMessage("authorization_denied")).toContain("was not completed");
    expect(googleMailOauthMessage("unknown_code")).toContain("could not be connected");
  });
});
