const SEND_WEEKDAYS = new Set(["Tue", "Wed", "Thu"]);

export const followUpOneTemplate = `Hi [Name],

I know you are likely in the middle of the work I wrote about last week.

I wanted to briefly circle back in case now is a better time. I am still available to help.`;

export const followUpTwoTemplate = `Hi [Name],

I imagine you have your hands full, so I will stop following up on this note.

If it becomes useful later, feel free to reach out. Wishing you a smooth stretch ahead.`;

export const outreachTimeZones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu"
] as const;

type ZonedParts = { year: number; month: number; day: number; weekday: string; hour: number; minute: number };

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((item) => item.type === type)?.value ?? "";
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(instant);
  const hour = Number(part(parts, "hour"));
  return {
    year: Number(part(parts, "year")),
    month: Number(part(parts, "month")),
    day: Number(part(parts, "day")),
    weekday: part(parts, "weekday"),
    hour: hour === 24 ? 0 : hour,
    minute: Number(part(parts, "minute"))
  };
}

export function zonedDateTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const seen = zonedParts(new Date(utc), timeZone);
    const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    const delta = desired - seenUtc;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

function addCalendarDays(year: number, month: number, day: number, days: number) {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function addBusinessDays(instant: Date, businessDays: number, timeZone: string) {
  const start = zonedParts(instant, timeZone);
  let cursor = { year: start.year, month: start.month, day: start.day };
  let remaining = businessDays;
  while (remaining > 0) {
    cursor = addCalendarDays(cursor.year, cursor.month, cursor.day, 1);
    const weekday = zonedParts(zonedDateTimeToUtc(cursor.year, cursor.month, cursor.day, 12, 0, timeZone), timeZone).weekday;
    if (weekday !== "Sat" && weekday !== "Sun") remaining -= 1;
  }
  return zonedDateTimeToUtc(cursor.year, cursor.month, cursor.day, start.hour, start.minute, timeZone);
}

export function nextOutreachSendAt(earliest: Date, timeZone: string) {
  const start = zonedParts(earliest, timeZone);
  for (let offset = 0; offset < 21; offset += 1) {
    const date = addCalendarDays(start.year, start.month, start.day, offset);
    const ten = zonedDateTimeToUtc(date.year, date.month, date.day, 10, 0, timeZone);
    const parts = zonedParts(ten, timeZone);
    if (!SEND_WEEKDAYS.has(parts.weekday)) continue;
    const windowStart = zonedDateTimeToUtc(parts.year, parts.month, parts.day, 9, 30, timeZone);
    const windowEnd = zonedDateTimeToUtc(parts.year, parts.month, parts.day, 11, 30, timeZone);
    if (windowEnd.getTime() < earliest.getTime()) continue;
    if (ten.getTime() >= earliest.getTime()) return ten;
    if (earliest.getTime() >= windowStart.getTime()) return earliest;
  }
  throw new Error("NO_SEND_WINDOW");
}

export function firstFollowUpAt(sentAt: Date, timeZone: string, now = new Date()) {
  const earliest = addBusinessDays(sentAt, 4, timeZone);
  return nextOutreachSendAt(earliest.getTime() > now.getTime() ? earliest : now, timeZone);
}

export function secondFollowUpAt(previousSentAt: Date, timeZone: string, now = new Date()) {
  const earliest = addBusinessDays(previousSentAt, 5, timeZone);
  return nextOutreachSendAt(earliest.getTime() > now.getTime() ? earliest : now, timeZone);
}

export function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const words = local.replace(/[._+-]+/g, " ").replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
  if (!words || /^(info|hello|sales|support|admin|office|team|contact|noreply|no reply)$/i.test(words)) return "";
  return words.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

export function fillFollowUp(template: string, name: string) {
  return template.replaceAll("[Name]", name.trim() || "there").trim();
}

export function liveReplyAlert(name: string, company: string) {
  const who = name.trim() || "a contact";
  const where = company.trim() ? ` at ${company.trim()}` : "";
  return `ALERT Live response received from ${who}${where}. Check your inbox immediately.`.slice(0, 320);
}

const bounceFrom = /^(mailer-daemon|postmaster|mail-daemon)@/i;
const bounceSubject = /\b(undeliverable|delivery status notification|mail delivery failed|delivery failure|returned mail|undelivered mail)\b/i;
const outOfOffice = /\b(out of (the )?office|automatic reply|auto-?reply|automated response|away from (the )?office|on vacation|currently out|i am out|ooo)\b/i;
const doNotContact = /\b(remove me|unsubscribe|do not contact)\b/i;

export function classifyInbound(input: { from: string; subject: string; text: string }) {
  const haystack = `${input.subject}\n${input.text}`;
  if (bounceFrom.test(input.from.trim()) || bounceSubject.test(input.subject)) return "bounce" as const;
  if (outOfOffice.test(haystack)) return "ooo" as const;
  if (doNotContact.test(haystack)) return "dnc" as const;
  return "reply" as const;
}

export function terminalLeadStatus(status: string) {
  return status === "replied" || status === "bounced" || status === "do_not_contact" || status === "passive";
}
