import { getAccountUser } from "@/server/data/accounts";
import { verifyDeviceToken } from "@/server/data/mobile";
import { getAccountProfile } from "@/server/data/read-model";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await verifyDeviceToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid device token." }, { status: 401 });
  }

  const account = await getAccountUser(auth.user);
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return NextResponse.json(
    await getAccountProfile({
      userId: account.id,
      login: account.login,
      displayName: account.displayName,
      bio: account.bio,
    }),
  );
}
