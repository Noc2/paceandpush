import { isAccountSettingsPatch } from "@/server/api/payloads";
import { getSessionUser } from "@/server/auth/session";
import { getAccountUser, updateAccountSettings } from "@/server/data/accounts";
import { refreshScoresAfterLeaderboardVisibilityChange } from "@/server/data/scores";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
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
    userId: user.id,
    publicLeaderboard: nextPublicLeaderboard,
    units: body.units === "imperial" || body.units === "metric" ? body.units : undefined,
  });

  if (
    typeof nextPublicLeaderboard === "boolean" &&
    nextPublicLeaderboard !== user.publicLeaderboard
  ) {
    await refreshScoresAfterLeaderboardVisibilityChange({
      userId: user.id,
      login: user.login,
      publicLeaderboard: nextPublicLeaderboard,
    });
  }

  return NextResponse.json({
    login: updatedUser.login,
    displayName: updatedUser.displayName,
    publicLeaderboard: updatedUser.publicLeaderboard,
    units: updatedUser.units,
  });
}
