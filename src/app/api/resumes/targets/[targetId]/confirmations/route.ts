import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { TargetResumeError } from "@/lib/resumes/target/generate";
import { saveResumeTargetConfirmations } from "@/lib/resumes/target/store";
import { targetConfirmationSchema } from "@/lib/resumes/target/types";

const bodySchema = z.object({ confirmations: z.array(targetConfirmationSchema).max(80) });

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ targetId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { targetId } = await params;
  if (!z.string().uuid().safeParse(targetId).success) return NextResponse.json({ error: "This targeted resume was not found." }, { status: 404 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirm each unmatched requirement with yes or no." }, { status: 400 });
  try {
    const result = await saveResumeTargetConfirmations(owner.database, owner.user.id, targetId, parsed.data.confirmations);
    return NextResponse.json(result);
  } catch (error) {
    const mapped = error instanceof TargetResumeError ? error : new TargetResumeError("CONFIRMATION_SAVE_FAILED", "Your confirmations could not be saved.");
    const status = mapped.code === "RESUME_TARGET_NOT_FOUND" ? 404 : mapped.code.startsWith("CONFIRMATION") ? 400 : 500;
    return NextResponse.json({ error: mapped.message }, { status });
  }
}
