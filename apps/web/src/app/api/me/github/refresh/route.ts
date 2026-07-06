import { getSessionUser } from "@/server/auth/session";
import { getAccountUser } from "@/server/data/accounts";
import {
  recomputeScoreSnapshots,
  refreshGitHubCommitsForUser,
} from "@/server/data/scores";
import { currentPeriod, periodForKind } from "@/lib/periods";
import { NextResponse } from "next/server";

export async function POST() {
  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

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
