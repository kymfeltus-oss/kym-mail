import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { careerEditableEntitySchema, careerTableByEntity, parseCareerEdit } from "@/lib/career/editing";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ entityType: string; recordId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  try {
    const { entityType: rawEntityType, recordId } = await params;
    const entityType = careerEditableEntitySchema.parse(rawEntityType);
    if (!z.uuid().safeParse(recordId).success || (entityType === "profile" && recordId !== owner.user.id)) {
      return NextResponse.json({ error: "Career record not found." }, { status: 404 });
    }
    const body = z.object({ changes: z.unknown() }).strict().parse(await request.json());
    const changes = parseCareerEdit(entityType, body.changes);
    const table = careerTableByEntity[entityType];
    const idColumn = entityType === "profile" ? "owner_id" : "id";

    const { data: existing, error: lookupError } = await owner.database
      .from(table)
      .select(idColumn)
      .eq(idColumn, recordId)
      .eq("owner_id", owner.user.id)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ error: "The career record could not be loaded." }, { status: 503 });
    if (!existing) return NextResponse.json({ error: "Career record not found." }, { status: 404 });

    const { error } = await owner.database
      .from(table)
      .update(changes)
      .eq(idColumn, recordId)
      .eq("owner_id", owner.user.id);
    if (error) return NextResponse.json({ error: "Check the career facts and try again." }, { status: error.code === "42501" ? 403 : 422 });
    return NextResponse.json({ updated: true, authorityStatus: "RESOLVED" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Check the career facts and try again." }, { status: 400 });
    }
    return NextResponse.json({ error: "The career record could not be updated." }, { status: 503 });
  }
}
