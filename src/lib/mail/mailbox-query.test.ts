import { describe, expect, it } from "vitest";
import type { ThreadListItem } from "@/components/mail-thread-list";
import { searchThreads, sortThreads, threadCorrespondent, withMessageParties } from "./mailbox-query";

const threads: ThreadListItem[] = [
  { id: "new", subject: "Budget review", snippet: "Please confirm the totals", last_message_at: "2026-10-06T15:00:00.000Z", is_unread: true, has_attachments: false, identityEmail: "kym@kymmailapp.com", fromAddress: "cfo@acme.com", toAddresses: ["kym@kymmailapp.com"] },
  { id: "old", subject: "Welcome packet", snippet: "Attached for your files", last_message_at: "2026-09-01T15:00:00.000Z", is_unread: false, has_attachments: true, identityEmail: "info@kymmailapp.com", fromAddress: "studio@parable.com", toAddresses: ["info@kymmailapp.com"] },
  { id: "mid", subject: "Invoice 104", snippet: "Payment received", last_message_at: "2026-10-01T15:00:00.000Z", is_unread: false, has_attachments: false, identityEmail: "kym@kymmailapp.com", fromAddress: "billing@acme.com", toAddresses: ["kym@kymmailapp.com"] }
];

describe("mailbox search and sort", () => {
  it("keeps the newest sender and recipients from each thread", () => {
    const attached = withMessageParties(
      [{ id: "thread", subject: "Hello", snippet: null, last_message_at: "2026-10-01T00:00:00.000Z", is_unread: false, has_attachments: false, identityEmail: "kym@kymmailapp.com" }],
      [
        { thread_id: "thread", from_address: "newer@example.com", to_addresses: ["kym@kymmailapp.com"] },
        { thread_id: "thread", from_address: "older@example.com", to_addresses: ["info@kymmailapp.com"] }
      ]
    );
    expect(attached[0]).toMatchObject({ fromAddress: "newer@example.com", toAddresses: ["kym@kymmailapp.com"] });
  });

  it("searches subject, people, and preview, and honors mailbox operators", () => {
    expect(searchThreads(threads, "budget").map((thread) => thread.id)).toEqual(["new"]);
    expect(searchThreads(threads, "acme").map((thread) => thread.id)).toEqual(["new", "mid"]);
    expect(searchThreads(threads, "from:parable").map((thread) => thread.id)).toEqual(["old"]);
    expect(searchThreads(threads, "to:info@kymmailapp.com").map((thread) => thread.id)).toEqual(["old"]);
    expect(searchThreads(threads, "subject:invoice").map((thread) => thread.id)).toEqual(["mid"]);
    expect(searchThreads(threads, "is:unread").map((thread) => thread.id)).toEqual(["new"]);
    expect(searchThreads(threads, "has:attachment from:parable").map((thread) => thread.id)).toEqual(["old"]);
    expect(searchThreads(threads, "   ")).toHaveLength(3);
  });

  it("sorts by date, sender, subject, and unread", () => {
    expect(sortThreads(threads, "newest", "inbox").map((thread) => thread.id)).toEqual(["new", "mid", "old"]);
    expect(sortThreads(threads, "oldest", "inbox").map((thread) => thread.id)).toEqual(["old", "mid", "new"]);
    expect(sortThreads(threads, "sender", "inbox").map((thread) => thread.id)).toEqual(["mid", "new", "old"]);
    expect(sortThreads(threads, "subject", "inbox").map((thread) => thread.id)).toEqual(["new", "mid", "old"]);
    expect(sortThreads(threads, "unread", "inbox").map((thread) => thread.id)).toEqual(["new", "mid", "old"]);
    expect(threadCorrespondent(threads[0], "sent")).toBe("kym@kymmailapp.com");
  });
});
