import { parseBoard, parsePeriod } from "@/server/data/read-model";
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
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  return NextResponse.json(await getCachedLeaderboard(board, period), {
    headers: {
      "cache-control": "no-store",
    },
  });
}
