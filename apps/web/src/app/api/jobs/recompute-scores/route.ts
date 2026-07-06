import {
  currentPeriod,
  parsePeriod,
  recomputeScoreSnapshots,
  refreshPublicGitHubCommits,
} from "@/server/data/scores";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = parsePeriod(request.nextUrl.searchParams.get("period") || currentPeriod());
  const github = await refreshPublicGitHubCommits(period);
  const scores = await recomputeScoreSnapshots(period);

  return NextResponse.json({
    ok: github.errors.length === 0,
    job: "recompute-scores",
    period,
    github,
    scores,
    processedAt: new Date().toISOString(),
  });
}
