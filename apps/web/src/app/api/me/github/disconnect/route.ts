import { getSessionUser } from "@/server/auth/session";
import { disconnectGitHubAccount, getAccountUser } from "@/server/data/accounts";
import { recomputeScoreSnapshots } from "@/server/data/scores";
import { currentPeriod, periodForKind } from "@/lib/periods";
import { NextResponse } from "next/server";

export async function DELETE() {
  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  await disconnectGitHubAccount(user.id);

  const now = new Date();
  const recomputePeriods = uniquePeriods([
    periodForKind("year", now),
    currentPeriod(now),
    periodForKind("week", now),
  ]);

  for (const period of recomputePeriods) {
    await recomputeScoreSnapshots(period);
  }

  return NextResponse.json({
    login: user.login,
    github: {
      connected: false,
      needsReconnect: false,
      updatedAt: null,
    },
    disconnectedAt: new Date().toISOString(),
  });
}

function uniquePeriods(periods: string[]): string[] {
  return [...new Set(periods)];
}
