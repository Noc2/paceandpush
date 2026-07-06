import { getLeaderboard, parseBoard, parsePeriod } from "@/server/data/read-model";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const board = parseBoard(request.nextUrl.searchParams.get("board"));
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  return NextResponse.json(await getLeaderboard(board, period), {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
