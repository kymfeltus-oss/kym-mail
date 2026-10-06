function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'");
}

export function htmlToPlainEmail(html: string) {
  return decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|blockquote|section|article)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, ""));
}

function isListLine(line: string) {
  return /^[-*•]\s+\S/.test(line) || /^\d+[.)]\s+\S/.test(line);
}

export function formatPlainEmail(value: string) {
  const lines = value.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").trim().split("\n");
  const paragraphs: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (!current.length) return;
    paragraphs.push(current.join(isListLine(current[0]) ? "\n" : " "));
    current = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (isListLine(line)) {
      if (current.length && !isListLine(current[0])) flush();
      current.push(line);
      continue;
    }
    if (current.length && isListLine(current[0])) flush();
    const previous = current.at(-1);
    const wrapped = previous && previous.length > 20 && !/[.!?:"']$/.test(previous) && /^[a-z("]/.test(line);
    if (wrapped && previous) current[current.length - 1] = `${previous} ${line}`;
    else {
      flush();
      current.push(line);
    }
  }
  flush();
  return paragraphs.join("\n\n");
}

export function formatPastedEmail(plain: string, html = "") {
  const source = html.trim() ? htmlToPlainEmail(html) : plain;
  return formatPlainEmail(source);
}
