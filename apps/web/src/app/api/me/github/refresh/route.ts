import { getSessionUser } from "@/server/auth/session";
import { minimumInterval, rateLimit } from "@/server/api/rate-limit";
import { getAccountUser } from "@/server/data/accounts";
import { publishPublicPeriods } from "@/server/data/public-discovery-cache";
import {
  refreshDirtyScorePeriodsForUser,
  refreshGitHubCommitsForUser,
  scorePeriodsRequiredForRefresh,
} from "@/server/data/scores";
import { periodForKind } from "@/lib/periods";
import { NextRequest, NextResponse } from "next/server";

const githubRefreshMinimumIntervalMs = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    bucket: "github-refresh",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  const throttled = minimumInterval(
    `github-refresh:user:${user.id}`,
    githubRefreshMinimumIntervalMs,
  );
  if (throttled) return throttled;

  try {
    const now = new Date();
    const refreshPeriod = periodForKind("year", now);
    const github = await refreshGitHubCommitsForUser({
      userId: user.id,
      login: user.login,
      period: refreshPeriod,
    });
    const scoreRefresh = await refreshDirtyScorePeriodsForUser(
      user.id,
      scorePeriodsRequiredForRefresh(refreshPeriod, now),
    );
    const warnings: string[] = [];
    try {
      await publishPublicPeriods(scoreRefresh.periods);
    } catch (error) {
      warnings.push("public_projection_refresh_failed");
      console.error("[github-refresh] public projection refresh failed", error);
    }

    return NextResponse.json({
      refreshedPeriod: refreshPeriod,
      refreshedPeriods: scoreRefresh.periods,
      github,
      scoreRefresh,
      refreshedAt: new Date().toISOString(),
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "GitHub refresh failed.",
      },
      { status: 409 },
    );
  }
}
