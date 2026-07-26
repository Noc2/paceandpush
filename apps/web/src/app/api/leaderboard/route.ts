import { parseBoard } from "@/server/data/read-model";
import { parsePublicPeriod } from "@/lib/periods";
import { getCachedLeaderboard } from "@/server/data/public-discovery-cache";
import { PublicProjectionUnavailableError } from "@/server/data/public-projection-store";
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

  try {
    return NextResponse.json(await getCachedLeaderboard(board, period), {
      headers: {
        "cache-control": "no-store",
      },
    });
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
