import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { ownerJobSchema, ownerJobUpdateSchema } from "@/lib/clients/validation";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ clientId: string; jobId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { clientId, jobId } = await params;
  if (!z.string().uuid().safeParse(clientId).success || !z.string().uuid().safeParse(jobId).success) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const result = ownerJobSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? "Check the job details." }, { status: 400 });
  const { data, error } = await owner.database.from("client_jobs").update({ title: result.data.title, status: result.data.status }).eq("id", jobId).eq("client_id", clientId).eq("owner_id", owner.user.id).select("id, title, status, updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "The job could not be updated." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  return NextResponse.json({ job: data });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ clientId: string; jobId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { clientId, jobId } = await params;
  if (!z.string().uuid().safeParse(clientId).success || !z.string().uuid().safeParse(jobId).success) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const result = ownerJobUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? "Enter a status update." }, { status: 400 });
  const { data: job } = await owner.database.from("client_jobs").select("id").eq("id", jobId).eq("client_id", clientId).eq("owner_id", owner.user.id).maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const { data, error } = await owner.database.from("client_job_updates").insert({
    owner_id: owner.user.id,
    job_id: jobId,
    body: result.data.body
  }).select("id, job_id, body, created_at").single();
  if (error || !data) return NextResponse.json({ error: "The status update could not be saved." }, { status: 503 });
  return NextResponse.json({ update: data }, { status: 201 });
}
