import { getPublicProfile } from "@/server/data/read-model";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ login: string }> },
) {
  const { login } = await context.params;
  const profile = getPublicProfile(decodeURIComponent(login));
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json(profile);
}
