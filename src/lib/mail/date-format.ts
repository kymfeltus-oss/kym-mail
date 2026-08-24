const ownerTimeZone = "America/Chicago";

const listTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ownerTimeZone,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

const fullTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ownerTimeZone,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

export function formatMailListTimestamp(value: string) {
  return listTimestampFormatter.format(new Date(value));
}

export function formatMailTimestamp(value: string) {
  return fullTimestampFormatter.format(new Date(value));
}

export function formatScheduledTimestamp(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}
