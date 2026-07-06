import { getPublicProfile, parsePeriod } from "@/server/data/read-model";
import { renderProfileChartSvg } from "@/server/charts/profile-chart";
import { parseUnitPreference } from "@/lib/distance-units";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ login: string }> },
) {
  const { login } = await context.params;
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const profile = await getPublicProfile(decodeURIComponent(login), period);
  const units = parseUnitPreference(request.nextUrl.searchParams.get("units"));

  if (!profile) {
    return new NextResponse("Profile not found.", { status: 404 });
  }

  return new NextResponse(renderProfileChartSvg(profile, units), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
