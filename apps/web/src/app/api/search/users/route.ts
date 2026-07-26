import { parsePublicPeriod } from "@/lib/periods";
import { searchCachedPublicUsers } from "@/server/data/public-discovery-cache";
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

  return NextResponse.json(await searchCachedPublicUsers({ limit, period, query }), {
    headers: {
      "cache-control": "no-store",
    },
  });
}

function parseSearchLimit(value: string | null): number | undefined {
  if (!value) return undefined;

  const limit = Number(value);
  return Number.isInteger(limit) ? limit : undefined;
}
