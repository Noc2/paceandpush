import { getSessionCookieName, getSessionUser } from "@/server/auth/session";
import { deleteAccountData, getAccountUser } from "@/server/data/accounts";
import {
  getScoreSnapshotPeriodsForUser,
  recomputeScoreSnapshotPeriods,
} from "@/server/data/scores";
import { NextResponse } from "next/server";

export async function DELETE() {
  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  const affectedPeriods = await getScoreSnapshotPeriodsForUser(user.id);
  await deleteAccountData(user.id);
  await recomputeScoreSnapshotPeriods(affectedPeriods);

  const response = NextResponse.json({
    login: user.login,
    status: "deleted",
    deletedAt: new Date().toISOString(),
  });
  response.cookies.delete(getSessionCookieName());
  return response;
}
