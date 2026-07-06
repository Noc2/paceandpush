import { getSessionCookieName } from "@/server/auth/session";
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({
    status: "signed_out",
    signedOutAt: new Date().toISOString(),
  });
  response.cookies.delete(getSessionCookieName());
  return response;
}
