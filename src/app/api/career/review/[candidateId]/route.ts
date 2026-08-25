import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";

const reviewSchema = z.object({
  action: z.enum(["APPROVE", "EDIT", "REJECT"]),
  editedClaim: z.string().trim().min(2).max(2000).optional()
}).strict().superRefine((value, context) => {
  if (value.action === "EDIT" && !value.editedClaim) {
    context.addIssue({ code: "custom", path: ["editedClaim"], message: "Enter the corrected fact before saving." });
  }
});

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  try {
    const { candidateId } = await params;
    if (!z.uuid().safeParse(candidateId).success) return NextResponse.json({ error: "Review item not found." }, { status: 404 });
    const input = reviewSchema.parse(await request.json());
    const { data, error } = await owner.database.rpc("resolve_career_candidate", {
      review_candidate_id: candidateId,
      resolution_action: input.action,
      edited_claim: input.editedClaim ?? null
    });
    if (error) {
      const notFound = /not found|already resolved/i.test(error.message);
      return NextResponse.json({ error: notFound ? "This review item has already been resolved." : "The career fact could not be resolved." }, { status: notFound ? 404 : 422 });
    }
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the review action." }, { status: 400 });
    return NextResponse.json({ error: "The career fact could not be resolved." }, { status: 503 });
  }
}

