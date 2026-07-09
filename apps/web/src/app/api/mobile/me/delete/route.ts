import { deleteAccountData } from "@/server/data/accounts";
import { verifyDeviceToken } from "@/server/data/mobile";
import {
  getScoreSnapshotPeriodsForUser,
  recomputeScoreSnapshotPeriods,
} from "@/server/data/scores";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest) {
  const auth = await verifyDeviceToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid device token." }, { status: 401 });
  }

  const affectedPeriods = await getScoreSnapshotPeriodsForUser(auth.user.id);
  await deleteAccountData(auth.user.id);
  await recomputeScoreSnapshotPeriods(affectedPeriods);

  return NextResponse.json({
    login: auth.user.login,
    status: "deleted",
    deletedAt: new Date().toISOString(),
  });
}
