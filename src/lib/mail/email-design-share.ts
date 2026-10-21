import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailDesignShareBucket, emailDesignImageMaxBytes } from "@/lib/mail/email-design-constants";

const emailDesignShareLifetimeMs = 90 * 24 * 60 * 60 * 1000;

type EmailDesignShareRow = {
  id: string;
  owner_id: string;
  token_hash: string;
  object_path: string;
  subject: string;
  from_address: string;
  text_body: string;
  expires_at: string;
};

export type EmailDesignShare = {
  id: string;
  token: string;
  tokenHash: string;
  url: string;
  expiresAt: string;
  objectPath: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function emailDesignShareUrl(token: string, baseUrl: string) {
  const normalizedBaseUrl = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`;
  return new URL(`/email-design/${encodeURIComponent(token)}`, normalizedBaseUrl).toString();
}

export function validPngFile(value: FormDataEntryValue | null): value is File {
  if (!(value instanceof File) || value.type !== "image/png" || value.size < 1 || value.size > emailDesignImageMaxBytes) return false;
  return true;
}

export function hasPngSignature(content: Uint8Array) {
  return content.length >= 8
    && content[0] === 0x89
    && content[1] === 0x50
    && content[2] === 0x4e
    && content[3] === 0x47
    && content[4] === 0x0d
    && content[5] === 0x0a
    && content[6] === 0x1a
    && content[7] === 0x0a;
}

async function purgeExpiredEmailDesignShares(database: SupabaseClient, ownerId: string) {
  const { data } = await database.from("email_design_shares")
    .select("id, object_path")
    .eq("owner_id", ownerId)
    .lt("expires_at", new Date().toISOString())
    .limit(100);
  if (!data?.length) return;
  const paths = data.map((row) => row.object_path as string);
  const { error: removeError } = await database.storage.from(emailDesignShareBucket).remove(paths);
  if (removeError) return;
  await database.from("email_design_shares").delete().in("id", data.map((row) => row.id as string));
}

export async function createEmailDesignShare({
  database,
  ownerId,
  image,
  subject,
  from,
  textBody,
  baseUrl,
  expiresAt = new Date(Date.now() + emailDesignShareLifetimeMs).toISOString()
}: {
  database: SupabaseClient;
  ownerId: string;
  image: Uint8Array;
  subject: string;
  from: string;
  textBody: string;
  baseUrl: string;
  expiresAt?: string;
}): Promise<EmailDesignShare> {
  if (!hasPngSignature(image) || image.byteLength > emailDesignImageMaxBytes) throw new Error("PIXEL_IMAGE_INVALID");
  await purgeExpiredEmailDesignShares(database, ownerId);

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const objectPath = `${ownerId}/${randomUUID()}.png`;
  const { error: uploadError } = await database.storage.from(emailDesignShareBucket)
    .upload(objectPath, image, { contentType: "image/png", upsert: false });
  if (uploadError) throw new Error("PIXEL_IMAGE_STORAGE_FAILED");

  const { data, error: insertError } = await database.from("email_design_shares").insert({
    owner_id: ownerId,
    token_hash: tokenHash,
    object_path: objectPath,
    subject,
    from_address: from,
    text_body: textBody,
    expires_at: expiresAt
  }).select("id").single();
  if (insertError || !data) {
    await database.storage.from(emailDesignShareBucket).remove([objectPath]);
    throw new Error("PIXEL_IMAGE_STORAGE_FAILED");
  }

  return { id: data.id, token, tokenHash, url: emailDesignShareUrl(token, baseUrl), expiresAt, objectPath };
}

export async function findEmailDesignShareByToken(database: SupabaseClient, token: string): Promise<EmailDesignShareRow | null> {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const { data, error } = await database.from("email_design_shares")
    .select("id, owner_id, token_hash, object_path, subject, from_address, text_body, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await database.storage.from(emailDesignShareBucket).remove([data.object_path]);
    await database.from("email_design_shares").delete().eq("id", data.id);
    return null;
  }
  return data as EmailDesignShareRow;
}

export async function loadEmailDesignShareByHash(database: SupabaseClient, tokenHash: string) {
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) return null;
  const { data, error } = await database.from("email_design_shares")
    .select("id, owner_id, token_hash, object_path, subject, from_address, text_body, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await database.storage.from(emailDesignShareBucket).remove([data.object_path]);
    await database.from("email_design_shares").delete().eq("id", data.id);
    return null;
  }
  const { data: file, error: downloadError } = await database.storage.from(emailDesignShareBucket).download(data.object_path);
  if (downloadError || !file) return null;
  return { share: data as EmailDesignShareRow, image: new Uint8Array(await file.arrayBuffer()) };
}

export async function removeEmailDesignShareByHash(database: SupabaseClient, tokenHash: string) {
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) return;
  const { data } = await database.from("email_design_shares").select("id, object_path").eq("token_hash", tokenHash).maybeSingle();
  if (!data) return;
  await database.storage.from(emailDesignShareBucket).remove([data.object_path]);
  await database.from("email_design_shares").delete().eq("id", data.id);
}

export async function updateEmailDesignShareExpiry(database: SupabaseClient, tokenHash: string, expiresAt: string) {
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) return;
  await database.from("email_design_shares").update({ expires_at: expiresAt }).eq("token_hash", tokenHash);
}
