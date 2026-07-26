import { getPublicProfile } from "@/server/data/read-model";
import { parsePublicPeriod } from "@/lib/periods";
import { rateLimit } from "@/server/api/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ login: string }> },
) {
  const limited = rateLimit(request, {
    bucket: "public-profile",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { login } = await context.params;
  const period = parsePublicPeriod(request.nextUrl.searchParams.get("period"));
  if (!period) {
    return NextResponse.json(
      { error: "Unsupported period." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const profile = await getPublicProfile(decodeURIComponent(login), period);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json(profile);
}
