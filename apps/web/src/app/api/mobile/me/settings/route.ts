import { isAccountSettingsPatch } from "@/server/api/payloads";
import { updateAccountSettings } from "@/server/data/accounts";
import { verifyDeviceToken } from "@/server/data/mobile";
import { invalidatePublicDiscoveryCache } from "@/server/data/public-discovery-cache";
import { refreshScoresAfterLeaderboardVisibilityChange } from "@/server/data/scores";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const auth = await verifyDeviceToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid device token." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (!isAccountSettingsPatch(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const nextPublicLeaderboard =
    typeof body.publicLeaderboard === "boolean" ? body.publicLeaderboard : undefined;

  const updatedUser = await updateAccountSettings({
    userId: auth.user.id,
    publicLeaderboard: nextPublicLeaderboard,
    publicHealthDataConsent: body.publicHealthDataConsent,
    units: body.units === "imperial" || body.units === "metric" ? body.units : undefined,
  });

  if (typeof nextPublicLeaderboard === "boolean") {
    invalidatePublicDiscoveryCache();
    await refreshScoresAfterLeaderboardVisibilityChange({
      userId: auth.user.id,
      login: auth.user.login,
      publicLeaderboard: updatedUser.publicLeaderboard,
    });
  }

  return NextResponse.json({
    login: updatedUser.login,
    displayName: updatedUser.displayName,
    publicLeaderboard: updatedUser.publicLeaderboard,
    publicActivityHistory: updatedUser.publicActivityHistory,
    publicHealthDataConsentVersion: updatedUser.publicHealthDataConsentVersion,
    publicHealthDataConsentedAt:
      updatedUser.publicHealthDataConsentedAt?.toISOString() ?? null,
    units: updatedUser.units,
  });
}
