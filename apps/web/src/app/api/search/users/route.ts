import { parsePeriod, searchPublicUsers } from "@/server/data/read-model";
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
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const limit = parseSearchLimit(request.nextUrl.searchParams.get("limit"));

  return NextResponse.json(await searchPublicUsers({ limit, period, query }), {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}

function parseSearchLimit(value: string | null): number | undefined {
  if (!value) return undefined;

  const limit = Number(value);
  return Number.isInteger(limit) ? limit : undefined;
}
