import { getSessionUser } from "@/server/auth/session";
import { getAccountUser } from "@/server/data/accounts";
import { createMobilePairingCode } from "@/server/data/mobile";
import { NextResponse } from "next/server";

export async function POST() {
  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  return NextResponse.json(await createMobilePairingCode({ userId: user.id }));
}
