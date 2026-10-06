export type Mailbox = "inbox" | "sent" | "undeliverable";

export type ThreadListItem = {
  id: string;
  subject: string;
  snippet: string | null;
  last_message_at: string;
  is_unread: boolean;
  has_attachments: boolean;
  identityEmail: string;
  fromAddress: string;
  toAddresses: string[];
};

export const mailSorts = ["newest", "oldest", "sender", "sender-desc", "subject", "unread"] as const;
export type MailSort = (typeof mailSorts)[number];

export function isMailSort(value: string): value is MailSort {
  return mailSorts.some((sort) => sort === value);
}

type MessageParty = {
  thread_id: string;
  from_address: string;
  to_addresses: string[] | null;
};

export function withMessageParties(
  threads: Array<Omit<ThreadListItem, "fromAddress" | "toAddresses">>,
  messages: MessageParty[]
): ThreadListItem[] {
  const latest = new Map<string, { fromAddress: string; toAddresses: string[] }>();
  for (const message of messages) {
    if (latest.has(message.thread_id)) continue;
    latest.set(message.thread_id, { fromAddress: message.from_address, toAddresses: message.to_addresses ?? [] });
  }
  return threads.map((thread) => {
    const party = latest.get(thread.id);
    return { ...thread, fromAddress: party?.fromAddress ?? "", toAddresses: party?.toAddresses ?? [] };
  });
}

export function threadCorrespondent(thread: ThreadListItem, mailbox: Mailbox) {
  if (mailbox === "sent" || mailbox === "undeliverable") return thread.toAddresses.filter(Boolean).join(", ") || thread.identityEmail;
  return thread.fromAddress || thread.identityEmail;
}

type SearchTerm =
  | { field: "any"; value: string }
  | { field: "from"; value: string }
  | { field: "to"; value: string }
  | { field: "subject"; value: string }
  | { field: "unread" }
  | { field: "attachment" };

function parseSearch(query: string): SearchTerm[] {
  const tokens = query.match(/"[^"]+"|\S+/g) ?? [];
  return tokens.flatMap((token): SearchTerm[] => {
    const bare = token.replaceAll('"', "").trim();
    if (!bare) return [];
    const operator = /^(from|to|subject|is|has):(.*)$/i.exec(bare);
    if (!operator) return [{ field: "any" as const, value: bare.toLowerCase() }];
    const key = operator[1].toLowerCase();
    const value = operator[2].trim().toLowerCase();
    if (key === "is" && value === "unread") return [{ field: "unread" as const }];
    if (key === "has" && (value === "attachment" || value === "attachments")) return [{ field: "attachment" as const }];
    if ((key === "from" || key === "to" || key === "subject") && value) return [{ field: key, value }];
    return [{ field: "any" as const, value: bare.toLowerCase() }];
  });
}

function includesText(value: string, term: string) {
  return value.toLowerCase().includes(term);
}

function matchesTerm(thread: ThreadListItem, term: SearchTerm) {
  if (term.field === "unread") return thread.is_unread;
  if (term.field === "attachment") return thread.has_attachments;
  if (term.field === "from") return includesText(`${thread.fromAddress} ${thread.identityEmail}`, term.value);
  if (term.field === "to") return thread.toAddresses.some((address) => includesText(address, term.value));
  if (term.field === "subject") return includesText(thread.subject, term.value);
  const haystack = [thread.subject, thread.snippet ?? "", thread.fromAddress, thread.toAddresses.join(" "), thread.identityEmail].join(" ");
  return includesText(haystack, term.value);
}

export function searchThreads(threads: ThreadListItem[], query: string) {
  const terms = parseSearch(query);
  if (!terms.length) return threads;
  return threads.filter((thread) => terms.every((term) => matchesTerm(thread, term)));
}

export function sortThreads(threads: ThreadListItem[], sort: MailSort, mailbox: Mailbox) {
  const ordered = [...threads];
  const byDate = (left: ThreadListItem, right: ThreadListItem, direction: 1 | -1) =>
    direction * (new Date(left.last_message_at).getTime() - new Date(right.last_message_at).getTime());
  const byText = (left: string, right: string) => left.localeCompare(right, undefined, { sensitivity: "base" });
  ordered.sort((left, right) => {
    if (sort === "oldest") return byDate(left, right, 1);
    if (sort === "sender" || sort === "sender-desc") {
      const compared = byText(threadCorrespondent(left, mailbox), threadCorrespondent(right, mailbox));
      if (compared !== 0) return sort === "sender" ? compared : -compared;
      return byDate(left, right, -1);
    }
    if (sort === "subject") {
      const compared = byText(left.subject, right.subject);
      return compared === 0 ? byDate(left, right, -1) : compared;
    }
    if (sort === "unread") {
      if (left.is_unread !== right.is_unread) return left.is_unread ? -1 : 1;
      return byDate(left, right, -1);
    }
    return byDate(left, right, -1);
  });
  return ordered;
}
