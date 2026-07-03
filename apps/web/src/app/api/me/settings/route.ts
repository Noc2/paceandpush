import { getSessionUser } from "@/server/auth/session";
import { getAccountUser, updateAccountSettings } from "@/server/data/accounts";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  let body: Partial<{ publicLeaderboard: boolean; units: "metric" | "imperial" }>;

  try {
    body = (await request.json()) as Partial<{
      publicLeaderboard: boolean;
      units: "metric" | "imperial";
    }>;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const updatedUser = await updateAccountSettings({
    userId: user.id,
    publicLeaderboard:
      typeof body.publicLeaderboard === "boolean" ? body.publicLeaderboard : undefined,
    units: body.units === "imperial" || body.units === "metric" ? body.units : undefined,
  });

  return NextResponse.json({
    login: updatedUser.login,
    displayName: updatedUser.displayName,
    publicLeaderboard: updatedUser.publicLeaderboard,
    units: updatedUser.units,
  });
}
