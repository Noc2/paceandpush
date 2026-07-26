import { getCachedPublicProfile } from "@/server/data/public-discovery-cache";
import { PublicProjectionUnavailableError } from "@/server/data/public-projection-store";
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

  let profile;
  try {
    profile = await getCachedPublicProfile(decodeURIComponent(login), period);
  } catch (error) {
    if (error instanceof PublicProjectionUnavailableError) {
      return NextResponse.json(
        { error: "Public activity data is temporarily unavailable." },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    throw error;
  }
  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found." },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(profile, {
    headers: { "cache-control": "no-store" },
  });
}
