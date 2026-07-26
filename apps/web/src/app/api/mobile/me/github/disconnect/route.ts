import { disconnectGitHubAccount } from "@/server/data/accounts";
import { revokeMobileDevice, verifyDeviceToken } from "@/server/data/mobile";
import { publishPublicPeriods } from "@/server/data/public-discovery-cache";
import {
  getScorePeriodsForUser,
  refreshDirtyScorePeriodsForUser,
  scorePeriodsRequiredForRefresh,
} from "@/server/data/scores";
import { currentPeriod } from "@/lib/periods";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest) {
  const auth = await verifyDeviceToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid device token." }, { status: 401 });
  }

  const affectedPeriods = await getScorePeriodsForUser(auth.user.id, [
    ...scorePeriodsRequiredForRefresh(currentPeriod()),
  ]);

  await disconnectGitHubAccount(auth.user.id);
  const device = await revokeMobileDevice({ id: auth.device.id, userId: auth.user.id });
  let refreshedPeriods: string[] = [];
  const warnings: string[] = [];
  try {
    const scoreRefresh = await refreshDirtyScorePeriodsForUser(
      auth.user.id,
      affectedPeriods,
    );
    refreshedPeriods = scoreRefresh.periods;
  } catch (error) {
    warnings.push("score_refresh_failed");
    console.error("[mobile-github-disconnect] score refresh failed", error);
  }
  if (refreshedPeriods.length > 0) {
    try {
      await publishPublicPeriods(refreshedPeriods);
    } catch (error) {
      warnings.push("public_projection_refresh_failed");
      console.error(
        "[mobile-github-disconnect] public projection refresh failed",
        error,
      );
    }
  }

  return NextResponse.json({
    login: auth.user.login,
    github: {
      connected: false,
      needsReconnect: false,
      updatedAt: null,
    },
    device: device ?? { ...auth.device, revoked: true },
    refreshedPeriods,
    disconnectedAt: new Date().toISOString(),
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
