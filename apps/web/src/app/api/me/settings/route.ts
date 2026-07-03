import { getSessionUser } from "@/server/auth/session";
import { getMe } from "@/server/data/read-model";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const me = getMe(await getSessionUser());
  let body: Partial<{ publicLeaderboard: boolean; units: "metric" | "imperial" }>;

  try {
    body = (await request.json()) as Partial<{
      publicLeaderboard: boolean;
      units: "metric" | "imperial";
    }>;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  return NextResponse.json({
    ...me,
    publicLeaderboard:
      typeof body.publicLeaderboard === "boolean"
        ? body.publicLeaderboard
        : me.publicLeaderboard,
    units: body.units === "imperial" ? "imperial" : "metric",
  });
}
