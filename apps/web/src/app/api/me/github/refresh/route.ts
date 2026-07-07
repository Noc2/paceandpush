import { getSessionUser } from "@/server/auth/session";
import { minimumInterval, rateLimit } from "@/server/api/rate-limit";
import { getAccountUser } from "@/server/data/accounts";
import {
  recomputeScoreSnapshots,
  refreshGitHubCommitsForUser,
} from "@/server/data/scores";
import { currentPeriod, periodForKind } from "@/lib/periods";
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
    const recomputePeriods = uniquePeriods([
      refreshPeriod,
      currentPeriod(now),
      periodForKind("week", now),
    ]);
    const github = await refreshGitHubCommitsForUser({
      userId: user.id,
      login: user.login,
      period: refreshPeriod,
    });
    const scores = [];

    for (const period of recomputePeriods) {
      scores.push(await recomputeScoreSnapshots(period));
    }

    return NextResponse.json({
      refreshedPeriod: refreshPeriod,
      recomputedPeriods: recomputePeriods,
      github,
      scores,
      refreshedAt: new Date().toISOString(),
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

function uniquePeriods(periods: string[]): string[] {
  return [...new Set(periods)];
}
