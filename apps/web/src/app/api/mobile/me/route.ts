import { getMe, parsePeriod } from "@/server/data/read-model";
import { verifyDeviceToken } from "@/server/data/mobile";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await verifyDeviceToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid device token." }, { status: 401 });
  }

  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  return NextResponse.json(await getMe(auth.user, period));
}
