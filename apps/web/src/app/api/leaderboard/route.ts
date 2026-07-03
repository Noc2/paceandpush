import { getLeaderboard, parseBoard } from "@/server/data/read-model";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const board = parseBoard(request.nextUrl.searchParams.get("board"));
  const period = request.nextUrl.searchParams.get("period") || undefined;
  return NextResponse.json(getLeaderboard(board, period));
}
