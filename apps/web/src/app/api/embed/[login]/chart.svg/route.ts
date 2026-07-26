import { getPublicProfile } from "@/server/data/read-model";
import { parsePublicPeriod } from "@/lib/periods";
import { parseProfileChartTheme, renderProfileChartSvg } from "@/server/charts/profile-chart";
import { parseUnitPreference } from "@/lib/distance-units";
import { rateLimit } from "@/server/api/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ login: string }> },
) {
  const limited = rateLimit(request, {
    bucket: "profile-embed",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { login } = await context.params;
  const period = parsePublicPeriod(request.nextUrl.searchParams.get("period"));
  if (!period) {
    return new NextResponse("Unsupported period.", {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }

  const profile = await getPublicProfile(decodeURIComponent(login), period);
  const units = parseUnitPreference(request.nextUrl.searchParams.get("units"));
  const theme = parseProfileChartTheme(request.nextUrl.searchParams.get("theme"));

  if (!profile) {
    return new NextResponse("Profile not found.", { status: 404 });
  }

  return new NextResponse(renderProfileChartSvg(profile, units, theme), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
