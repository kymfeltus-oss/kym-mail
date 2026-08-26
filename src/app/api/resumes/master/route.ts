import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { approveMasterResumeVersion, createMasterResumeVersion } from "@/lib/resumes/master";
import { masterResumeContentSchema } from "@/lib/resumes/types";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE") }),
  z.object({ action: z.literal("EDIT"), content: masterResumeContentSchema }),
  z.object({ action: z.literal("APPROVE"), versionId: z.string().uuid() })
]);

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Master Resume request is invalid." }, { status: 422 });
  try {
    const result = parsed.data.action === "APPROVE"
      ? await approveMasterResumeVersion(owner.database, owner.user.id, parsed.data.versionId)
      : await createMasterResumeVersion(owner.database, owner.user.id, parsed.data.action === "EDIT" ? parsed.data.content : undefined);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "MASTER_RESUME_REQUEST_FAILED";
    const status = code === "MASTER_RESUME_REFRESH_REQUIRED" ? 409 : code === "RESUME_FACT_VALIDATION_FAILED" ? 422 : 500;
    return NextResponse.json({ error: code === "MASTER_RESUME_REFRESH_REQUIRED" ? "Career information changed. Create a refreshed Master Resume version before approval." : "KYM Mail could not complete the Master Resume request.", code }, { status });
  }
}
