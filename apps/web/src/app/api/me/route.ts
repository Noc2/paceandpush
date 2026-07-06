import { getSessionUser } from "@/server/auth/session";
import { getMe, parsePeriod } from "@/server/data/read-model";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  return NextResponse.json(await getMe(await getSessionUser(), period));
}
