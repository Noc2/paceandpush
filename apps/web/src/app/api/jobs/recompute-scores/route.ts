import { timingSafeEqual } from "node:crypto";
import {
  currentPeriod,
  parsePeriod,
  recomputeScoreSnapshots,
  refreshGitHubCommits,
} from "@/server/data/scores";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!isAuthorizedCronRequest(authorization, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = parsePeriod(request.nextUrl.searchParams.get("period") || currentPeriod());
  try {
    const github = await refreshGitHubCommits(period);
    const scores = await recomputeScoreSnapshots(period);
    const totalGitHubFailure = github.checked > 0 && github.errors.length === github.checked;

    return NextResponse.json(
      {
        ok: github.errors.length === 0,
        job: "recompute-scores",
        period,
        github,
        scores,
        processedAt: new Date().toISOString(),
      },
      { status: totalGitHubFailure ? 502 : 200 },
    );
  } catch (error) {
    console.error("[cron] recompute-scores failed", error);
    return NextResponse.json(
      {
        ok: false,
        job: "recompute-scores",
        period,
        error: "Score recompute failed.",
        processedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

function isAuthorizedCronRequest(
  authorization: string | null,
  cronSecret: string | undefined,
): boolean {
  const bearerPrefix = "Bearer ";
  if (!cronSecret || !authorization?.startsWith(bearerPrefix)) return false;

  const actual = Buffer.from(authorization.slice(bearerPrefix.length));
  const expected = Buffer.from(cronSecret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
