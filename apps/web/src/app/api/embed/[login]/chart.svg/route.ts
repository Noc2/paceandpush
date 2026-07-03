import { getPublicProfile } from "@/server/data/read-model";
import { renderProfileChartSvg } from "@/server/charts/profile-chart";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ login: string }> },
) {
  const { login } = await context.params;
  const profile = await getPublicProfile(decodeURIComponent(login));

  if (!profile) {
    return new NextResponse("Profile not found.", { status: 404 });
  }

  return new NextResponse(renderProfileChartSvg(profile), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
