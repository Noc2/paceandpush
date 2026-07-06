import { getAccountUser } from "@/server/data/accounts";
import { verifyDeviceToken } from "@/server/data/mobile";
import { getAccountProfile, parsePeriod } from "@/server/data/read-model";
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

  const period = parsePeriod(request.nextUrl.searchParams.get("period"));

  return NextResponse.json(
    await getAccountProfile({
      userId: account.id,
      login: account.login,
      displayName: account.displayName,
      bio: account.bio,
      period,
    }),
  );
}
