import { describe, expect, it } from "vitest";
import { readApiJson } from "./read-api-json";

describe("readApiJson", () => {
  it("returns parsed JSON when the response is valid", async () => {
    const response = new Response(JSON.stringify({ error: "Reconnect Google Mail to continue." }), { status: 401 });
    await expect(readApiJson(response)).resolves.toEqual({ error: "Reconnect Google Mail to continue." });
  });

  it("maps a Request Entity Too Large body to a clear send error", async () => {
    const response = new Response("Request Entity Too Large", { status: 413 });
    await expect(readApiJson(response)).resolves.toEqual({ error: "The message or attachments are too large to send this way." });
  });

  it("maps a non-JSON unauthorized body to a reconnect message", async () => {
    const response = new Response("Request Env unavailable", { status: 401 });
    await expect(readApiJson(response)).resolves.toEqual({ error: "Reconnect Google Mail to continue." });
  });
});
