import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { getContactProviderConfiguration, getContactProviders } from "@/lib/contacts/providers";
import { loadContactIntelligenceView } from "@/lib/contacts/store";
import { addManualContact, approveContact, rejectContact, runContactSearch } from "@/lib/contacts/workflow";
import { AppError, toSafeError } from "@/lib/errors";
import { log } from "@/lib/logger";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SEARCH"), projectId: z.string().uuid().nullable().optional() }),
  z.object({ action: z.literal("REFRESH"), projectId: z.string().uuid().nullable().optional() }),
  z.object({
    action: z.literal("MANUAL_ADD"),
    fullName: z.string().trim().min(2).max(160),
    currentTitle: z.string().trim().min(2).max(200),
    department: z.string().trim().max(120).optional(),
    seniority: z.string().trim().max(80).optional(),
    location: z.string().trim().max(200).optional(),
    professionalProfileUrl: z.union([z.string().url().startsWith("https://"), z.literal("")]).optional(),
    evidenceUrl: z.union([z.string().url().startsWith("https://"), z.literal("")]).optional(),
    projectId: z.string().uuid().nullable().optional()
  }),
  z.object({ action: z.literal("APPROVE"), contactId: z.string().uuid() }),
  z.object({ action: z.literal("REJECT"), contactId: z.string().uuid() })
]);

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function statusFor(error: unknown) {
  if (!(error instanceof AppError)) return 500;
  return error.code === "UNAUTHORIZED" ? 401 : error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : error.code === "VALIDATION" ? 422 : 503;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { jobId } = await params;
  if (!z.string().uuid().safeParse(jobId).success) return NextResponse.json({ error: "Saved job not found." }, { status: 404 });
  const { data: job } = await owner.database.from("job_opportunities").select("id, status").eq("owner_id", owner.user.id).eq("id", jobId).maybeSingle();
  if (!job || job.status !== "SAVED") return NextResponse.json({ error: "Saved job not found." }, { status: 404 });
  try {
    return NextResponse.json({ intelligence: await loadContactIntelligenceView(owner.database, owner.user.id, jobId, getContactProviderConfiguration()) });
  } catch {
    return NextResponse.json({ error: "Contact intelligence is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { jobId } = await params;
  if (!z.string().uuid().safeParse(jobId).success) return NextResponse.json({ error: "Saved job not found." }, { status: 404 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Contact request is invalid." }, { status: 422 });
  try {
    if (parsed.data.action === "SEARCH" || parsed.data.action === "REFRESH") {
      const result = await runContactSearch(owner.database, owner.user.id, jobId, getContactProviders(), parsed.data.projectId);
      log("info", "job_contact_search_completed", { jobId, status: result.status, discovered: result.discovered });
      return NextResponse.json(result);
    }
    if (parsed.data.action === "MANUAL_ADD") {
      const result = await addManualContact(owner.database, owner.user.id, jobId, parsed.data);
      log("info", "job_contact_manual_added", { jobId, contactId: result.contactId });
      return NextResponse.json(result, { status: 201 });
    }
    if (parsed.data.action === "APPROVE") {
      await approveContact(owner.database, owner.user.id, jobId, parsed.data.contactId);
      log("info", "job_contact_approved", { jobId, contactId: parsed.data.contactId });
      return NextResponse.json({ contactId: parsed.data.contactId, approvalState: "APPROVED" });
    }
    await rejectContact(owner.database, owner.user.id, jobId, parsed.data.contactId);
    log("info", "job_contact_rejected", { jobId, contactId: parsed.data.contactId });
    return NextResponse.json({ contactId: parsed.data.contactId, approvalState: "REJECTED" });
  } catch (error) {
    const safe = toSafeError(error);
    log("warn", "job_contact_action_failed", { jobId, action: parsed.data.action, code: safe.code });
    return NextResponse.json({ error: safe.safeMessage, code: safe.code, existingContactsPreserved: true }, { status: statusFor(error) });
  }
}
