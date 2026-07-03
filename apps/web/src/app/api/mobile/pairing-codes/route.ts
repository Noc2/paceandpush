import { getSessionUser } from "@/server/auth/session";
import { createPairingCode } from "@/server/mobile/tokens";
import { NextResponse } from "next/server";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  return NextResponse.json(createPairingCode(user));
}
