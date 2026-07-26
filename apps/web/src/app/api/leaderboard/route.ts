import { parseBoard } from "@/server/data/read-model";
import { parsePublicPeriod } from "@/lib/periods";
import { getCachedLeaderboard } from "@/server/data/public-discovery-cache";
import { rateLimit } from "@/server/api/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, {
    bucket: "leaderboard",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const board = parseBoard(request.nextUrl.searchParams.get("board"));
  const period = parsePublicPeriod(request.nextUrl.searchParams.get("period"));
  if (!period) {
    return NextResponse.json(
      { error: "Unsupported period." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(await getCachedLeaderboard(board, period), {
    headers: {
      "cache-control": "no-store",
    },
  });
}
