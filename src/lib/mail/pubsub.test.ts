import { describe, expect, it } from "vitest";
import { parseGmailPushNotification } from "./pubsub";

describe("Gmail Pub/Sub notification parsing", () => {
  it("decodes and normalizes a valid Gmail notification", () => {
    const data = Buffer.from(JSON.stringify({ emailAddress: "Owner@Example.com", historyId: "123456" })).toString("base64");
    expect(parseGmailPushNotification({ message: { data, messageId: "pubsub-1" }, subscription: "projects/kym-mail/subscriptions/mail" })).toEqual({
      deduplicationKey: "owner@example.com:123456",
      providerEmail: "owner@example.com",
      historyId: "123456",
      pubSubMessageId: "pubsub-1"
    });
  });

  it("accepts the snake-case identifiers used by Pub/Sub push delivery", () => {
    const data = Buffer.from(JSON.stringify({ emailAddress: "owner@example.com", historyId: 654321 })).toString("base64");
    expect(parseGmailPushNotification({ message: { data, message_id: "pubsub-2", publish_time: "2026-08-24T00:00:00Z" } })).toMatchObject({
      pubSubMessageId: "pubsub-2",
      historyId: "654321"
    });
  });

  it("rejects malformed envelopes and decoded data", () => {
    expect(parseGmailPushNotification({})).toBeNull();
    expect(parseGmailPushNotification({ message: { data: Buffer.from("not-json").toString("base64"), messageId: "1" } })).toBeNull();
  });
});
