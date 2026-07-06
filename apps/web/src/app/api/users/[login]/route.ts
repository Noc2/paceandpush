import { getPublicProfile, parsePeriod } from "@/server/data/read-model";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ login: string }> },
) {
  const { login } = await context.params;
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const profile = await getPublicProfile(decodeURIComponent(login), period);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json(profile);
}
