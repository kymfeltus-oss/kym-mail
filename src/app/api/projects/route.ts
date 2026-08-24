import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { parseProjectCreateInput } from "@/lib/projects/validation";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}
export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  try {
    const input = parseProjectCreateInput(await request.json());
    const { data: identity, error: identityError } = await owner.database
      .from("mail_accounts")
      .select("id")
      .eq("id", input.defaultMailAccountId)
      .eq("owner_id", owner.user.id)
      .eq("is_active", true)
      .eq("send_as_state", "available")
      .maybeSingle();
    if (identityError || !identity) return NextResponse.json({ error: "Select an available default sending identity." }, { status: 400 });

    const { data: project, error } = await owner.database.from("projects").insert({
      owner_id: owner.user.id,
      name: input.name,
      type: input.type,
      objective: input.objective,
      default_mail_account_id: input.defaultMailAccountId,
      parameter_schema_version: 1,
      parameters: input.parameters
    }).select("id").single();
    if (error || !project) return NextResponse.json({ error: "The Project could not be saved." }, { status: 503 });
    return NextResponse.json({ projectId: project.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the Project details." }, { status: 400 });
    return NextResponse.json({ error: "The Project could not be saved." }, { status: 503 });
  }
}
