import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { parseProjectUpdateInput, projectStatusSchema, projectTypes, projectValidationErrorPayload, type ProjectType } from "@/lib/projects/validation";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

const mutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("details"), payload: z.unknown() }),
  z.object({ kind: z.literal("status"), status: projectStatusSchema })
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  try {
    const { projectId } = await params;
    if (!z.string().uuid().safeParse(projectId).success) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const { data: existing, error: lookupError } = await owner.database
      .from("projects")
      .select("id, type, status")
      .eq("id", projectId)
      .eq("owner_id", owner.user.id)
      .maybeSingle();
    if (lookupError || !existing || !projectTypes.includes(existing.type as ProjectType)) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const mutation = mutationSchema.parse(await request.json());
    if (mutation.kind === "status") {
      if (existing.status === "ARCHIVED" && mutation.status !== "ACTIVE") {
        return NextResponse.json({ error: "Restore an archived Project before changing its status." }, { status: 409 });
      }
      const { error } = await owner.database.from("projects").update({ status: mutation.status }).eq("id", projectId).eq("owner_id", owner.user.id);
      if (error) return NextResponse.json({ error: "The Project status could not be updated." }, { status: 503 });
      return NextResponse.json({ updated: true });
    }

    if (existing.status === "ARCHIVED") return NextResponse.json({ error: "Restore this Project before editing it." }, { status: 409 });
    const input = parseProjectUpdateInput(existing.type as ProjectType, mutation.payload);
    const { data: identity, error: identityError } = await owner.database
      .from("mail_accounts")
      .select("id")
      .eq("id", input.defaultMailAccountId)
      .eq("owner_id", owner.user.id)
      .eq("is_active", true)
      .eq("send_as_state", "available")
      .maybeSingle();
    if (identityError || !identity) return NextResponse.json({ error: "Select an available default sending identity.", fieldErrors: { defaultMailAccountId: "Select an available default sending identity." } }, { status: 400 });
    const { error } = await owner.database.from("projects").update({
      name: input.name,
      objective: input.objective,
      default_mail_account_id: input.defaultMailAccountId,
      parameter_schema_version: 1,
      parameters: input.parameters
    }).eq("id", projectId).eq("owner_id", owner.user.id);
    if (error) return NextResponse.json({ error: "The Project could not be updated." }, { status: 503 });
    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json(projectValidationErrorPayload(error), { status: 400 });
    return NextResponse.json({ error: "The Project could not be updated." }, { status: 503 });
  }
}
