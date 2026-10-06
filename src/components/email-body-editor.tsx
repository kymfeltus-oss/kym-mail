"use client";

import { useEffect, useRef } from "react";
import { formatPastedEmail } from "@/lib/mail/paste-format";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function plainToEditorHtml(value: string) {
  const blocks = value.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  if (!blocks.length || !value.trim()) return "<p><br></p>";
  return blocks.map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length > 1 && lines.every((line) => /^[-*•]\s+\S/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    return `<p>${escapeHtml(block).replaceAll("\n", "<br>")}</p>`;
  }).join("");
}

function editorToPlain(root: HTMLElement) {
  const blocks = [...root.childNodes].map((node) => {
    if (!(node instanceof HTMLElement)) return node.textContent?.trim() ?? "";
    if (node.tagName === "UL" || node.tagName === "OL") {
      return [...node.querySelectorAll("li")].map((item) => `- ${item.textContent?.trim() ?? ""}`).filter((line) => line !== "-").join("\n");
    }
    return (node.innerText || node.textContent || "").replace(/\n+/g, " ").trim();
  }).filter(Boolean);
  return blocks.join("\n\n");
}

export function EmailBodyEditor({ name = "body", value, onChange, placeholder = "Write your message…" }: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const skip = useRef(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || skip.current) return;
    if (editorToPlain(editor) === value.trim()) return;
    editor.innerHTML = plainToEditorHtml(value);
  }, [value]);

  function publish() {
    const editor = editorRef.current;
    if (!editor) return;
    skip.current = true;
    onChange(editorToPlain(editor));
    queueMicrotask(() => { skip.current = false; });
  }

  function onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const formatted = formatPastedEmail(event.clipboardData.getData("text/plain"), event.clipboardData.getData("text/html"));
    document.execCommand("insertHTML", false, plainToEditorHtml(formatted));
    publish();
  }

  return <div>
    <div
      ref={editorRef}
      role="textbox"
      aria-multiline="true"
      aria-label="Message"
      contentEditable
      data-placeholder={placeholder}
      onInput={publish}
      onPaste={onPaste}
      className="email-composer"
      suppressContentEditableWarning
    />
    <input type="hidden" name={name} value={value} />
  </div>;
}
