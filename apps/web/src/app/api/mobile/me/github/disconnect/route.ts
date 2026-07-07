import { disconnectGitHubAccount } from "@/server/data/accounts";
import { revokeMobileDevice, verifyDeviceToken } from "@/server/data/mobile";
import {
  getScoreSnapshotPeriodsForUser,
  recomputeScoreSnapshotPeriods,
} from "@/server/data/scores";
import { currentPeriod, periodForKind } from "@/lib/periods";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest) {
  const auth = await verifyDeviceToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid device token." }, { status: 401 });
  }

  const now = new Date();
  const affectedPeriods = await getScoreSnapshotPeriodsForUser(auth.user.id, [
    periodForKind("year", now),
    currentPeriod(now),
    periodForKind("week", now),
  ]);

  await disconnectGitHubAccount(auth.user.id);
  const device = await revokeMobileDevice({ id: auth.device.id, userId: auth.user.id });
  await recomputeScoreSnapshotPeriods(affectedPeriods);

  return NextResponse.json({
    login: auth.user.login,
    github: {
      connected: false,
      needsReconnect: false,
      updatedAt: null,
    },
    device: device ?? { ...auth.device, revoked: true },
    disconnectedAt: new Date().toISOString(),
  });
}
