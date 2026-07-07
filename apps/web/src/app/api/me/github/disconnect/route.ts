import { getSessionUser } from "@/server/auth/session";
import { disconnectGitHubAccount, getAccountUser } from "@/server/data/accounts";
import {
  getScoreSnapshotPeriodsForUser,
  recomputeScoreSnapshotPeriods,
} from "@/server/data/scores";
import { currentPeriod, periodForKind } from "@/lib/periods";
import { NextResponse } from "next/server";

export async function DELETE() {
  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  const now = new Date();
  const affectedPeriods = await getScoreSnapshotPeriodsForUser(user.id, [
    periodForKind("year", now),
    currentPeriod(now),
    periodForKind("week", now),
  ]);

  await disconnectGitHubAccount(user.id);
  await recomputeScoreSnapshotPeriods(affectedPeriods);

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
