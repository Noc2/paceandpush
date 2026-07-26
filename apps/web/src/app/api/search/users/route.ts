import { parsePublicPeriod } from "@/lib/periods";
import { searchCachedPublicUsers } from "@/server/data/public-discovery-cache";
import { PublicProjectionUnavailableError } from "@/server/data/public-projection-store";
import { rateLimit } from "@/server/api/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, {
    bucket: "user-search",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const period = parsePublicPeriod(request.nextUrl.searchParams.get("period"));
  if (!period) {
    return NextResponse.json(
      { error: "Unsupported period." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const limit = parseSearchLimit(request.nextUrl.searchParams.get("limit"));

  try {
    return NextResponse.json(
      await searchCachedPublicUsers({ limit, period, query }),
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof PublicProjectionUnavailableError) {
      return NextResponse.json(
        { error: "Public activity data is temporarily unavailable." },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    throw error;
  }
}

function parseSearchLimit(value: string | null): number | undefined {
  if (!value) return undefined;

  const limit = Number(value);
  return Number.isInteger(limit) ? limit : undefined;
}
