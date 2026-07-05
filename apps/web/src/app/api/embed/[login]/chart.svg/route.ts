import { getPublicProfile } from "@/server/data/read-model";
import { renderProfileChartSvg } from "@/server/charts/profile-chart";
import { parseUnitPreference } from "@/lib/distance-units";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ login: string }> },
) {
  const { login } = await context.params;
  const profile = await getPublicProfile(decodeURIComponent(login));
  const units = parseUnitPreference(new URL(request.url).searchParams.get("units"));

  if (!profile) {
    return new NextResponse("Profile not found.", { status: 404 });
  }

  return new NextResponse(renderProfileChartSvg(profile, units), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
