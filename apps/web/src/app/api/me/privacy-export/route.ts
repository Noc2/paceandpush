import { getSessionUser } from "@/server/auth/session";
import { exportAccountData, getAccountUser } from "@/server/data/accounts";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    data: await exportAccountData(user.id),
    notes: ["Daily running distance totals are exported without raw workouts."],
  });
}
