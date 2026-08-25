type Level = "debug" | "info" | "warn" | "error";
const priorities: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const blocked = /token|secret|password|authorization|cookie|email|description|resume|career|profile/i;

function sanitize(context: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, blocked.test(key) ? "[REDACTED]" : value]));
}
export function log(level: Level, event: string, context: Record<string, unknown> = {}) {
  const configured = (process.env.LOG_LEVEL as Level) || "info";
  if (priorities[level] < (priorities[configured] ?? priorities.info)) return;
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...sanitize(context) });
  const output = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  output(entry);
}
