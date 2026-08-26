import { createHash, randomUUID } from "node:crypto";

export const consultationProofBucket = "consultation-payment-proofs";
export const MAX_CONSULTATION_PROOF_BYTES = 8 * 1024 * 1024;
const acceptedTypes = new Set(["image/png", "image/jpeg", "application/pdf"]);
const extensions: Record<string, Set<string>> = {
  "image/png": new Set(["png"]),
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "application/pdf": new Set(["pdf"])
};

function extensionOf(filename: string) {
  return filename.toLowerCase().split(".").pop() ?? "";
}

export function safeConsultationProofName(filename: string) {
  const base = filename.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "").slice(-120);
  return base || "payment-proof";
}

export function hasExpectedProofSignature(content: Uint8Array, mimeType: string) {
  if (mimeType === "image/png") return content.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => content[index] === value);
  if (mimeType === "image/jpeg") return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  if (mimeType === "application/pdf") return content.length >= 5 && Buffer.from(content.subarray(0, 5)).toString("ascii") === "%PDF-";
  return false;
}

export async function validateConsultationProof(file: File) {
  if (!acceptedTypes.has(file.type) || file.size < 1 || file.size > MAX_CONSULTATION_PROOF_BYTES) return null;
  if (!extensions[file.type]?.has(extensionOf(file.name))) return null;
  const content = new Uint8Array(await file.arrayBuffer());
  if (!hasExpectedProofSignature(content, file.type)) return null;
  return {
    content,
    safeName: safeConsultationProofName(file.name),
    mimeType: file.type,
    sizeBytes: file.size,
    sha256: createHash("sha256").update(content).digest("hex")
  };
}

export function consultationProofPath(ownerId: string, requestId: string, safeName: string) {
  return `${ownerId}/${requestId}/${randomUUID()}-${safeName}`;
}
