import { NextResponse, type NextRequest } from "next/server";
import { clearClientPortalSession } from "@/lib/clients/session";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  await clearClientPortalSession();
  return NextResponse.json({ signedOut: true });
}
