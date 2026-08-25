import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";

const addFactSchema = z.object({
  factType: z.enum([
    "PROFESSIONAL_IDENTITY", "EXPERIENCE_CONTEXT", "ACCOMPLISHMENT", "FINANCE_CAPABILITY",
    "ACCOUNTING_CAPABILITY", "TECHNOLOGY", "SYSTEM", "EDUCATION", "CREDENTIAL", "PROJECT"
  ]),
  claim: z.string().trim().min(2).max(2000),
  reason: z.string().trim().min(2).max(1000).optional()
}).strict();

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  try {
    const input = addFactSchema.parse(await request.json());
    const { data, error } = await owner.database.rpc("add_owner_career_fact", {
      fact_kind: input.factType,
      claim: input.claim,
      change_reason: input.reason ?? null
    });
    if (error) return NextResponse.json({ error: "The owner fact could not be added." }, { status: 422 });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the career fact." }, { status: 400 });
    return NextResponse.json({ error: "The owner fact could not be added." }, { status: 503 });
  }
}

