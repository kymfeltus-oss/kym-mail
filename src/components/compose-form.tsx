"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Paperclip, Send, X, CloudUpload, Check, LoaderCircle, FileVideo2, RefreshCw } from "lucide-react";
import { readApiJson } from "@/lib/http/read-api-json";
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_COUNT, MAX_TOTAL_ATTACHMENT_BYTES, validateAttachmentEntries } from "@/lib/mail/attachment-validation";
import { composeAttachmentBucket } from "@/lib/scheduling/constants";
import { EmailBodyEditor } from "@/components/email-body-editor";
import { buildProfessionalEmailHtml, defaultEmailLookForSender, emailLogoAssetForLook, emailLookChrome, emailLooks, isEmailLook, type EmailLook } from "@/lib/mail/professional-html";
import { appendDriveLinkSection } from "@/lib/mail/drive-link-attachments";
import { blockedAttachmentPattern } from "@/lib/mail/compose-validation";

export type ComposeIdentity = { id: string; email_address: string; label: string; is_default: boolean };
export type ComposeProject = { id: string; name: string; default_mail_account_id: string | null };
export type ComposeDraft = {
  mode: "reply" | "forward";
  from?: string;
  to: string;
  subject: string;
  body?: string;
  providerThreadId?: string;
  replyToMessageId?: string;
  forwardedAttachments?: Array<{ id: string; filename: string; sizeBytes: number }>;
};

type StagedAttachment = { path: string; filename: string; mimeType: string; size: number };
type SignedAttachmentUpload = { path: string; token: string };
type DriveAttachment = {
  key: string;
  file: File;
  sessionUrl?: string;
  driveFileId?: string;
  uploadedBytes: number;
  status: "ready" | "uploading" | "done" | "error";
};

const MAX_DRIVE_FILE_BYTES = 5 * 1024 ** 4;
const DRIVE_CHUNK_BYTES = 32 * 1024 * 1024;

function resumableOffset(xhr: XMLHttpRequest) {
  const range = xhr.getResponseHeader("Range");
  const match = range?.match(/^bytes=0-(\d+)$/);
  return match ? Number(match[1]) + 1 : 0;
}

function sendDriveChunk(sessionUrl: string, file: File, start: number, end: number, onProgress: (uploaded: number) => void) {
  return new Promise<{ status: number; nextByte: number; metadata: { id?: string } | null }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sessionUrl);
    xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${file.size}`);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(start + event.loaded); };
    xhr.onload = () => {
      let metadata: { id?: string } | null = null;
      if (xhr.status === 200 || xhr.status === 201) {
        try { metadata = JSON.parse(xhr.responseText) as { id?: string }; }
        catch { reject(new Error("Google Drive finished the upload without returning a file record.")); return; }
      }
      resolve({ status: xhr.status, nextByte: resumableOffset(xhr), metadata });
    };
    xhr.onerror = () => reject(new Error("The connection dropped during the Drive upload."));
    xhr.ontimeout = () => reject(new Error("The Drive upload timed out. You can retry and resume it."));
    xhr.timeout = 0;
    xhr.send(file.slice(start, end));
  });
}

async function queryDriveUpload(sessionUrl: string, file: File) {
  let response: Response;
  try {
    response = await fetch("/api/mail/drive-uploads/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionUrl, size: file.size })
    });
  } catch {
    throw new Error("Could not check the Drive upload progress. Retry when your connection is available.");
  }
  const payload = await readApiJson<{ error?: string; offset?: number; fileId?: string; expired?: boolean }>(response);
  if (payload.expired) throw new Error(payload.error || "This Google Drive upload session expired. Remove the file and select it again to restart.");
  if (!response.ok || typeof payload.offset !== "number") {
    throw new Error(payload.error || "Could not check the Drive upload progress. Retry when your connection is available.");
  }
  return { offset: payload.offset, fileId: payload.fileId };
}

async function uploadFileToDrive(sessionUrl: string, file: File, initialOffset: number, onProgress: (uploaded: number) => void) {
  let cursor = 0;
  if (initialOffset > 0) {
    const confirmed = await queryDriveUpload(sessionUrl, file);
    if (confirmed.fileId) { onProgress(file.size); return confirmed.fileId; }
    cursor = confirmed.offset;
  }
  let retries = 0;
  while (cursor < file.size) {
    const end = Math.min(cursor + DRIVE_CHUNK_BYTES, file.size);
    try {
      const result = await sendDriveChunk(sessionUrl, file, cursor, end, onProgress);
      if (result.status === 200 || result.status === 201) {
        if (!result.metadata?.id) throw new Error("Google Drive did not return the uploaded file ID.");
        onProgress(file.size);
        return result.metadata.id;
      }
      if (result.status === 308) {
        if (result.nextByte < cursor) throw new Error("Google Drive returned an invalid upload position.");
        if (result.nextByte === cursor) {
          if (retries >= 3) throw new Error("Google Drive did not confirm upload progress. Retry the file upload.");
          retries += 1;
          await new Promise((resolve) => window.setTimeout(resolve, 800 * retries));
          continue;
        }
        cursor = Math.min(result.nextByte, file.size);
        onProgress(cursor);
        retries = 0;
        continue;
      }
      if (result.status < 500 && result.status !== 429) throw new Error(`Google Drive rejected the upload (HTTP ${result.status}).`);
      throw new Error("Google Drive had a temporary upload error.");
    } catch (error) {
      if (retries >= 3) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 800 * (retries + 1)));
      const confirmed = await queryDriveUpload(sessionUrl, file);
      if (confirmed.fileId) { onProgress(file.size); return confirmed.fileId; }
      cursor = confirmed.offset;
      onProgress(cursor);
      retries += 1;
    }
  }
  throw new Error("Google Drive ended the upload without returning the file ID.");
}

const attachmentLimitMessage = "Add up to 25 safe file types. Inline email attachments can be up to 20 MB each and 25 MB total; larger files use Google Drive links.";

async function cleanupStagedUploads(paths: string[]) {
  if (!paths.length) return;
  try {
    await fetch("/api/mail/attachments/upload", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paths })
    });
  } catch { /* The server also removes staged uploads after each send or schedule attempt. */ }
}

async function uploadComposeAttachments(files: File[]): Promise<StagedAttachment[]> {
  if (!files.length) return [];
  const response = await fetch("/api/mail/attachments/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files: files.map((file) => ({ name: file.name, size: file.size, type: file.type })) })
  });
  const payload = await readApiJson<{ error?: string; uploads?: SignedAttachmentUpload[] }>(response);
  if (!response.ok || !payload.uploads || payload.uploads.length !== files.length) {
    throw new Error(payload.error || "The attachments could not be prepared for upload.");
  }

  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  }).storage.from(composeAttachmentBucket);
  try {
    const staged: StagedAttachment[] = [];
    for (const [index, file] of files.entries()) {
      const upload = payload.uploads[index];
      const { error } = await storage.uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type || "application/octet-stream" });
      if (error) throw new Error(`Could not upload ${file.name}. ${error.message}`);
      staged.push({ path: upload.path, filename: file.name, mimeType: file.type || "application/octet-stream", size: file.size });
    }
    return staged;
  } catch (error) {
    await cleanupStagedUploads(payload.uploads.map((upload) => upload.path));
    throw error;
  }
}

function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ComposeForm({ identities, projects = [], initialProjectId = "", initialLook, draft, successPath, onSent }: {
  identities: ComposeIdentity[];
  projects?: ComposeProject[];
  initialProjectId?: string;
  initialLook?: EmailLook;
  draft?: ComposeDraft;
  successPath?: string;
  onSent?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const globalDefault = identities.find((identity) => identity.is_default) ?? identities[0];
  const initialProject = projects.find((project) => project.id === initialProjectId);
  const initialProjectIdentity = identities.find((identity) => identity.id === initialProject?.default_mail_account_id);
  const draftIdentity = identities.find((identity) => identity.email_address === draft?.from);
  const [projectId, setProjectId] = useState(initialProject?.id ?? "");
  const [from, setFrom] = useState(draftIdentity?.email_address ?? (initialProject ? initialProjectIdentity?.email_address ?? "" : globalDefault?.email_address ?? ""));
  const [advanced, setAdvanced] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveAttachment[]>([]);
  const [forwardedAttachments, setForwardedAttachments] = useState(draft?.forwardedAttachments ?? []);
  const [status, setStatus] = useState<"idle" | "sending" | "scheduling" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState(() => localInputValue(new Date(Date.now() + 5 * 60_000)));
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago");
  const [body, setBody] = useState(draft?.body ?? "");
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [look, setLook] = useState<EmailLook>(() => initialLook ?? defaultEmailLookForSender(from, draftIdentity?.label ?? initialProjectIdentity?.label ?? globalDefault?.label ?? ""));
  const selectedProject = projects.find((project) => project.id === projectId);
  const previewChrome = emailLookChrome(look);
  const defaultIdentityUnavailable = Boolean(selectedProject && !identities.some((identity) => identity.id === selectedProject.default_mail_account_id));

  function updateDriveFile(key: string, updates: Partial<DriveAttachment>) {
    setDriveFiles((current) => current.map((item) => item.key === key ? { ...item, ...updates } : item));
  }

  async function uploadPendingDriveFiles() {
    const uploadedIds: string[] = [];
    for (const item of driveFiles) {
      if (item.driveFileId) { uploadedIds.push(item.driveFileId); continue; }
      let sessionUrl = item.sessionUrl;
      try {
        updateDriveFile(item.key, { status: "uploading" });
        if (!sessionUrl) {
          const response = await fetch("/api/mail/drive-uploads", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ from, name: item.file.name, mimeType: item.file.type || "application/octet-stream", size: item.file.size })
          });
          const payload = await readApiJson<{ error?: string; sessionUrl?: string }>(response);
          if (!response.ok || !payload.sessionUrl) throw new Error(payload.error || "Google Drive could not prepare the upload.");
          sessionUrl = payload.sessionUrl;
          updateDriveFile(item.key, { sessionUrl, uploadedBytes: 0 });
        }
        const driveFileId = await uploadFileToDrive(sessionUrl, item.file, item.uploadedBytes, (uploadedBytes) => updateDriveFile(item.key, { uploadedBytes }));
        updateDriveFile(item.key, { driveFileId, uploadedBytes: item.file.size, status: "done" });
        uploadedIds.push(driveFileId);
      } catch (cause) {
        updateDriveFile(item.key, { status: "error" });
        throw cause;
      }
    }
    return uploadedIds;
  }

  function applyFrom(nextFrom: string) {
    setFrom(nextFrom);
  }

  function selectProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    const project = projects.find((item) => item.id === nextProjectId);
    if (!project) { applyFrom(globalDefault?.email_address ?? ""); return; }
    const identity = identities.find((item) => item.id === project.default_mail_account_id);
    applyFrom(identity?.email_address ?? "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending"); setError(null);
    if (!body.trim()) { setStatus("error"); setError("Write a message before sending."); return; }
    if (!validateAttachmentEntries([
      ...forwardedAttachments.map((attachment) => ({ name: attachment.filename, size: attachment.sizeBytes })),
      ...files.map((file) => ({ name: file.name, size: file.size }))
    ])) {
      setStatus("error"); setError(attachmentLimitMessage); return;
    }
    if (attachmentCount > MAX_ATTACHMENT_COUNT) { setStatus("error"); setError(attachmentLimitMessage); return; }
    const data = new FormData(event.currentTarget);
    data.delete("attachments");
    let staged: StagedAttachment[] = [];
    try {
      data.set("driveFileIds", JSON.stringify(await uploadPendingDriveFiles()));
      staged = await uploadComposeAttachments(files);
      data.set("uploadedAttachments", JSON.stringify(staged));
      const response = await fetch("/api/mail/send", { method: "POST", body: data });
      const payload = await readApiJson<{ error?: string; sent?: boolean }>(response);
      if (!response.ok && !payload.sent) throw new Error(payload.error || "The message could not be sent.");
      formRef.current?.reset(); setFiles([]); setDriveFiles([]); setForwardedAttachments([]); setBody(""); setSubject(""); onSent?.();
      if (successPath) router.push(successPath); else router.push("/app/sent?sent=true");
      router.refresh();
    } catch (cause) {
      await cleanupStagedUploads(staged.map((attachment) => attachment.path));
      setStatus("error"); setError(cause instanceof Error ? cause.message : "The message could not be sent.");
    }
  }

  async function schedule() {
    const form = formRef.current;
    if (!form?.reportValidity()) return;
    const instant = new Date(scheduledLocal);
    if (!scheduledLocal || !Number.isFinite(instant.getTime()) || instant.getTime() <= Date.now()) {
      setStatus("error"); setError("Choose a valid future delivery date and time."); return;
    }
    if (!validateAttachmentEntries([
      ...forwardedAttachments.map((attachment) => ({ name: attachment.filename, size: attachment.sizeBytes })),
      ...files.map((file) => ({ name: file.name, size: file.size }))
    ])) {
      setStatus("error"); setError(attachmentLimitMessage); return;
    }
    if (attachmentCount > MAX_ATTACHMENT_COUNT) { setStatus("error"); setError(attachmentLimitMessage); return; }
    setStatus("scheduling"); setError(null);
    const data = new FormData(form);
    data.delete("attachments");
    data.set("scheduledFor", instant.toISOString()); data.set("timezone", timezone);
    let staged: StagedAttachment[] = [];
    try {
      data.set("driveFileIds", JSON.stringify(await uploadPendingDriveFiles()));
      staged = await uploadComposeAttachments(files);
      data.set("uploadedAttachments", JSON.stringify(staged));
      const response = await fetch("/api/mail/schedule", { method: "POST", body: data });
      const payload = await readApiJson<{ error?: string; id?: string }>(response);
      if (!response.ok || !payload.id) throw new Error(payload.error || "The email could not be scheduled.");
      router.push(`/app/scheduled/${payload.id}?scheduled=true`); router.refresh();
    } catch (cause) {
      await cleanupStagedUploads(staged.map((attachment) => attachment.path));
      setStatus("error"); setError(cause instanceof Error ? cause.message : "The email could not be scheduled.");
    }
  }

  function addSelectedFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const incoming = Array.from(input.files ?? []);
    const nextFiles = [...files];
    const nextDriveFiles = [...driveFiles];
    const duplicate = (file: File) => nextFiles.some((current) => current.name === file.name && current.size === file.size && current.lastModified === file.lastModified)
      || nextDriveFiles.some((current) => current.file.name === file.name && current.file.size === file.size && current.file.lastModified === file.lastModified);
    let inlineBytes = forwardedAttachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0) + nextFiles.reduce((sum, file) => sum + file.size, 0);
    let selectionError = "";
    for (const file of incoming) {
      if (duplicate(file)) continue;
      if (file.size <= 0 || file.size > MAX_DRIVE_FILE_BYTES || blockedAttachmentPattern.test(file.name)) {
        selectionError = "Choose a non-empty, supported file up to 5 TB.";
        continue;
      }
      if (forwardedAttachments.length + nextFiles.length + nextDriveFiles.length >= MAX_ATTACHMENT_COUNT) {
        selectionError = attachmentLimitMessage;
        break;
      }
      if (file.size <= MAX_ATTACHMENT_BYTES && inlineBytes + file.size <= MAX_TOTAL_ATTACHMENT_BYTES) {
        nextFiles.push(file);
        inlineBytes += file.size;
      } else {
        nextDriveFiles.push({ key: crypto.randomUUID(), file, uploadedBytes: 0, status: "ready" });
      }
    }
    const entries = [
      ...forwardedAttachments.map((attachment) => ({ name: attachment.filename, size: attachment.sizeBytes })),
      ...nextFiles.map((file) => ({ name: file.name, size: file.size }))
    ];
    if (!validateAttachmentEntries(entries)) selectionError = attachmentLimitMessage;
    setFiles(nextFiles); setDriveFiles(nextDriveFiles); setStatus(selectionError ? "error" : "idle"); setError(selectionError || null); input.value = "";
  }

  const schedulePreview = scheduledLocal && Number.isFinite(new Date(scheduledLocal).getTime())
    ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(scheduledLocal))
    : "Choose a future time";
  const attachmentCount = forwardedAttachments.length + files.length + driveFiles.length;
  const attachmentBytes = forwardedAttachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0) + files.reduce((sum, file) => sum + file.size, 0);
  const previewBody = appendDriveLinkSection(body || "Your message will appear here.", driveFiles.filter((item) => item.driveFileId).map((item) => ({ id: item.driveFileId!, name: item.file.name, url: `https://drive.google.com/file/d/${encodeURIComponent(item.driveFileId!)}/view` })));
  const senderLockedByDriveUpload = driveFiles.some((item) => item.sessionUrl || item.driveFileId);
  const reconnectDisabled = status === "sending" || status === "scheduling";
  const reconnectClassName = "inline-flex items-center gap-2 rounded-full border border-fuchsia-300/35 bg-[#101828] px-5 py-3 text-sm font-semibold text-fuchsia-200 transition hover:border-fuchsia-200/60 hover:bg-[#172033]";

  return <form ref={formRef} onSubmit={submit} className="glass min-w-0 rounded-3xl p-5 sm:p-8">
    {draft?.providerThreadId && <input type="hidden" name="providerThreadId" value={draft.providerThreadId} />}
    {draft?.replyToMessageId && <input type="hidden" name="replyToMessageId" value={draft.replyToMessageId} />}
    {forwardedAttachments.map((attachment) => <input key={attachment.id} type="hidden" name="forwardAttachmentIds" value={attachment.id} />)}
    <div className="grid min-w-0 gap-5">
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#F4F7FB]">Project
        <select name="projectId" value={projectId} onChange={(event) => selectProject(event.target.value)} className="w-full min-w-0 rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3 font-normal text-[#F4F7FB] outline-none focus:border-[#22D3EE]">
          <option value="">None</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <span className="font-normal text-[#93A0B5]">Optional. Ordinary email does not require a Project.</span>
      </label>
      {defaultIdentityUnavailable && <div role="alert" className="rounded-2xl border border-[#1D4E89] bg-[#122033] px-4 py-3"><p className="text-sm font-semibold text-[#67E8F9]">Project default sender is unavailable</p><p className="mt-1 text-xs leading-5 text-[#93A0B5]">Choose a verified From identity explicitly. KYM Mail will not switch senders silently.</p></div>}
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#F4F7FB]">From
        <select name="from" value={from} onChange={(event) => applyFrom(event.target.value)} required disabled={status === "sending" || status === "scheduling" || senderLockedByDriveUpload} className="w-full min-w-0 rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3 font-normal text-[#F4F7FB] outline-none focus:border-[#22D3EE] disabled:opacity-70">
          <option value="">Select a verified sender</option>
          {identities.map((identity) => <option key={identity.id} value={identity.email_address}>{identity.email_address} — {identity.label}</option>)}
        </select>
        {senderLockedByDriveUpload && <span className="font-normal text-[#93A0B5]">Remove Drive files to switch senders; the upload is stored in the selected sender’s Google Drive.</span>}
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#F4F7FB]">Company
        <select name="emailLook" value={look} onChange={(event) => { if (isEmailLook(event.target.value)) setLook(event.target.value); }} className="w-full min-w-0 rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3 font-normal text-[#F4F7FB] outline-none focus:border-[#22D3EE]">
          {emailLooks.filter((option) => !option.id.startsWith("parable") && option.id !== "mass").map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          <optgroup label="PARABLE WORLD">
            {emailLooks.filter((option) => option.id.startsWith("parable")).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </optgroup>
          {emailLooks.filter((option) => option.id === "mass").map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
        <span className="font-normal text-[#93A0B5]">The selected company stationery and your signature go to the recipient.</span>
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#F4F7FB]">To
        <input name="to" type="text" inputMode="email" required defaultValue={draft?.to} placeholder="recipient@example.com" className="w-full min-w-0 rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3 font-normal outline-none placeholder:text-[#93A0B5] focus:border-[#22D3EE]" />
      </label>
      {!advanced && <button type="button" onClick={() => setAdvanced(true)} className="w-fit text-xs font-semibold text-[#67E8F9]">Add CC or BCC</button>}
      {advanced && <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#F4F7FB]">CC<input name="cc" type="text" inputMode="email" className="w-full min-w-0 rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3 font-normal outline-none focus:border-[#22D3EE]" /></label>
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#F4F7FB]">BCC<input name="bcc" type="text" inputMode="email" className="w-full min-w-0 rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3 font-normal outline-none focus:border-[#22D3EE]" /></label>
      </div>}
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#F4F7FB]">Subject
        <input name="subject" type="text" required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full min-w-0 rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3 font-normal outline-none focus:border-[#22D3EE]" />
      </label>
      <div className="grid min-w-0 gap-2 text-sm font-semibold text-[#F4F7FB]">Message
        <EmailBodyEditor value={body} onChange={setBody} />
        <span className="font-normal text-[#93A0B5]">Pasted text becomes paragraphs with spacing. A blank line starts a new paragraph, and lines that start with - become a list.</span>
      </div>
      <section aria-label="Recipient preview" className="border p-3" style={{ background: previewChrome.masthead, borderColor: previewChrome.masthead }}>
        <p className="px-2 text-[10px] font-semibold uppercase tracking-[.28em]" style={{ color: previewChrome.accent }}>Recipient preview</p>
        <iframe title="How the recipient will see this message" sandbox="" srcDoc={buildProfessionalEmailHtml({ from: from || "your verified sender", subject: subject || "Message preview", body: previewBody, look, logoImageSource: emailLogoAssetForLook(look)?.path })} className="mt-3 h-[520px] w-full border-0" style={{ background: previewChrome.page }} />
      </section>
      <div className="rounded-2xl border border-cyan-200/15 bg-[#080e1a]/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#F4F7FB]">Attachments</p>
            <p className="mt-1 text-xs leading-5 text-[#93A0B5]">Up to {MAX_ATTACHMENT_COUNT} files. Inline email attachments: {MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB each · {MAX_TOTAL_ATTACHMENT_BYTES / (1024 * 1024)} MB total.</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs leading-5 text-cyan-100"><CloudUpload className="size-3.5 shrink-0" /> Larger files upload to Drive in resumable chunks and become viewable to anyone with the link when sent.</p>
            {attachmentCount > 0 && <p role="status" aria-live="polite" className="mt-2 text-xs font-semibold text-cyan-100">{attachmentCount} selected · {(attachmentBytes / (1024 * 1024)).toFixed(1)} MB inline</p>}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/[.05] px-4 py-2.5 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-200/10"><Paperclip className="size-4 text-[#22D3EE]" /> {attachmentCount ? "Add more files" : "Attach files"}<input name="attachments" type="file" multiple disabled={status === "sending" || status === "scheduling"} className="sr-only" onChange={addSelectedFiles} /></label>
        </div>
        {(forwardedAttachments.length > 0 || files.length > 0 || driveFiles.length > 0) && <ul className="mt-3 space-y-2">
          {forwardedAttachments.map((attachment) => <li key={attachment.id} className="flex items-center justify-between rounded-xl bg-[#122033] px-3 py-2 text-xs text-[#93A0B5]"><span className="truncate">{attachment.filename} · {(attachment.sizeBytes / (1024 * 1024)).toFixed(1)} MB · from original message</span><button type="button" disabled={status === "sending" || status === "scheduling"} aria-label={`Remove ${attachment.filename}`} onClick={() => { setForwardedAttachments((current) => current.filter((item) => item.id !== attachment.id)); setStatus("idle"); setError(null); }}><X className="size-4" /></button></li>)}
          {files.map((file, index) => <li key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between rounded-xl bg-[#122033] px-3 py-2 text-xs text-[#93A0B5]"><span className="truncate">{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB</span><button type="button" disabled={status === "sending" || status === "scheduling"} aria-label={`Remove ${file.name}`} onClick={() => { setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index)); setStatus("idle"); setError(null); }}><X className="size-4" /></button></li>)}
          {driveFiles.map((item) => {
            const progress = Math.min(100, Math.round(item.uploadedBytes / item.file.size * 100));
            return <li key={item.key} className="rounded-xl border border-cyan-300/15 bg-[#0b1525] px-3 py-2.5 text-xs text-[#93A0B5]">
              <div className="flex min-w-0 items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><FileVideo2 className="size-4 shrink-0 text-[#22D3EE]" /><span className="truncate">{item.file.name} · {(item.file.size / (1024 * 1024)).toFixed(item.file.size >= 1024 * 1024 * 1024 ? 2 : 1)} MB · Drive link</span></span>
                {item.status === "done" ? <span className="inline-flex shrink-0 items-center gap-1 text-emerald-300"><Check className="size-3.5" /> Link ready</span> : item.status === "uploading" ? <span className="inline-flex shrink-0 items-center gap-1 text-cyan-100"><LoaderCircle className="size-3.5 animate-spin" /> {progress}%</span> : item.status === "error" ? <span className="shrink-0 text-amber-300">Retry on send</span> : <span className="shrink-0 text-[#93A0B5]">Ready</span>}
                <button type="button" disabled={status === "sending" || status === "scheduling"} aria-label={`Remove ${item.file.name}`} onClick={() => { setDriveFiles((current) => current.filter((driveFile) => driveFile.key !== item.key)); setStatus("idle"); setError(null); }}><X className="size-4" /></button>
              </div>
              {item.status === "uploading" && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-[width]" style={{ width: `${progress}%` }} /></div>}
            </li>;
          })}
        </ul>}
      </div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-[#122033] px-4 py-3 text-sm text-[#67E8F9]">{error}</p>}
    {scheduleOpen && <section aria-label="Schedule delivery" className="mt-6 rounded-2xl border border-[#1D4E89] bg-[#122033] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-[#F4F7FB]">Schedule delivery</h2><p className="mt-1 text-xs leading-5 text-[#93A0B5]">KYM Mail will send automatically using the approved message and sender.</p></div><button type="button" aria-label="Close scheduling" onClick={() => setScheduleOpen(false)} className="rounded-lg p-1 text-[#93A0B5]"><X className="size-4" /></button></div>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-[#F4F7FB]">Date and time<input type="datetime-local" value={scheduledLocal} min={localInputValue(new Date(Date.now() + 60_000))} onChange={(event) => setScheduledLocal(event.target.value)} className="w-full rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3 font-normal outline-none focus:border-[#22D3EE]" /></label>
      <p className="mt-3 text-sm font-semibold text-[#67E8F9]">{schedulePreview}</p><p className="mt-1 text-xs text-[#93A0B5]">Timezone: {timezone}</p>
      <button type="button" onClick={() => void schedule()} disabled={status === "scheduling" || !identities.length || !from} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0E1C33] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"><CalendarClock className="size-4" /> {status === "scheduling" ? attachmentCount ? "Uploading & scheduling…" : "Scheduling…" : "Confirm schedule"}</button>
    </section>}
    <div className="mt-7 flex flex-wrap justify-end gap-3">
      {reconnectDisabled
        ? <span aria-disabled="true" className={`${reconnectClassName} cursor-not-allowed opacity-50`}><RefreshCw className="size-4" /> Reconnect Google Mail</span>
        : <Link href="/api/oauth/google/start" className={reconnectClassName}><RefreshCw className="size-4" /> Reconnect Google Mail</Link>}
      <button type="button" onClick={() => setScheduleOpen((current) => !current)} disabled={status === "sending" || status === "scheduling" || !identities.length || !from} className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE] bg-[#101828] px-6 py-3 text-sm font-semibold text-[#67E8F9] disabled:opacity-60"><CalendarClock className="size-4" /> Schedule send</button>
      <button type="submit" disabled={status === "sending" || status === "scheduling" || !identities.length || !from} className="inline-flex items-center gap-2 rounded-full kym-action px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,.22)] transition  disabled:cursor-not-allowed disabled:opacity-60"><Send className="size-4" /> {status === "sending" ? attachmentCount ? "Uploading & sending…" : "Sending…" : draft?.mode === "reply" ? "Send reply" : draft?.mode === "forward" ? "Forward now" : "Send now"}</button>
    </div>
  </form>;
}
