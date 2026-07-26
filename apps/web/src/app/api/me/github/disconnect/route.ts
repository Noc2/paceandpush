import { getSessionUser } from "@/server/auth/session";
import { disconnectGitHubAccount, getAccountUser } from "@/server/data/accounts";
import { publishPublicPeriods } from "@/server/data/public-discovery-cache";
import {
  getScorePeriodsForUser,
  refreshDirtyScorePeriodsForUser,
  scorePeriodsRequiredForRefresh,
} from "@/server/data/scores";
import { currentPeriod } from "@/lib/periods";
import { NextResponse } from "next/server";

export async function DELETE() {
  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  const affectedPeriods = await getScorePeriodsForUser(user.id, [
    ...scorePeriodsRequiredForRefresh(currentPeriod()),
  ]);

  await disconnectGitHubAccount(user.id);
  const scoreRefresh = await refreshDirtyScorePeriodsForUser(user.id, affectedPeriods);
  const warnings: string[] = [];
  try {
    await publishPublicPeriods(scoreRefresh.periods);
  } catch (error) {
    warnings.push("public_projection_refresh_failed");
    console.error("[github-disconnect] public projection refresh failed", error);
  }

  return NextResponse.json({
    login: user.login,
    github: {
      connected: false,
      needsReconnect: false,
      updatedAt: null,
    },
    refreshedPeriods: scoreRefresh.periods,
    disconnectedAt: new Date().toISOString(),
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
