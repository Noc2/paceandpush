import { timingSafeEqual } from "node:crypto";
import { publishPublicPeriods } from "@/server/data/public-discovery-cache";
import {
  currentPeriod,
  drainDirtyScorePeriods,
  parsePeriod,
  refreshGitHubCommits,
} from "@/server/data/scores";
import { measureOperation } from "@/server/observability/operations";
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
    const github = await measureOperation(
      "cron.github_refresh",
      () => refreshGitHubCommits(period),
      (result) => ({
        affectedRows: result.updatedDays,
        errorCount: result.errors.length,
        itemCount: result.checked,
      }),
    );
    const dirtyScores = await measureOperation(
      "cron.score_refresh",
      () => drainDirtyScorePeriods({ limit: 500 }),
      (result) => ({
        affectedRows: result.processed,
        errorCount: result.failed.length,
        itemCount: result.users,
      }),
    );
    const refreshedPeriods = uniquePeriods([
      ...github.scoreRefreshes.flatMap((refresh) => refresh.periods),
      ...dirtyScores.refreshed.flatMap((refresh) => refresh.periods),
    ]);
    await measureOperation(
      "cron.public_projection_refresh",
      () => publishPublicPeriods(refreshedPeriods),
      () => ({ itemCount: refreshedPeriods.length }),
    );
    const totalGitHubFailure = github.checked > 0 && github.errors.length === github.checked;
    const scoreRefreshFailure = dirtyScores.failed.length > 0;

    return NextResponse.json(
      {
        ok: github.errors.length === 0 && !scoreRefreshFailure,
        job: "recompute-scores",
        period,
        github,
        dirtyScores,
        refreshedPeriods,
        processedAt: new Date().toISOString(),
      },
      { status: totalGitHubFailure || scoreRefreshFailure ? 502 : 200 },
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

function uniquePeriods(periods: Iterable<string>): string[] {
  return [...new Set(periods)].sort();
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
