import { getSessionUser } from "@/server/auth/session";
import { getMe, getPublicProfile } from "@/server/data/read-model";
import { NextResponse } from "next/server";

export async function GET() {
  const me = getMe(await getSessionUser());
  const profile = getPublicProfile(me.login);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    account: me,
    profile,
    notes: [
      "PoC export uses fixture-backed data.",
      "Daily distance totals are exported without raw workouts.",
    ],
  });
}
