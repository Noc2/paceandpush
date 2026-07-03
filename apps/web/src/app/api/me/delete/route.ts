import { getSessionUser } from "@/server/auth/session";
import { getMe } from "@/server/data/read-model";
import { NextResponse } from "next/server";

export async function DELETE() {
  const me = getMe(await getSessionUser());

  return NextResponse.json({
    login: me.login,
    status: "queued",
    requestedAt: new Date().toISOString(),
  });
}
