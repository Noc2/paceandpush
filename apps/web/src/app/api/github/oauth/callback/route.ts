import { getSessionCookieName, signSession } from "@/server/auth/session";
import {
  demoGitHubUser,
  exchangeGitHubCode,
  fetchGitHubUser,
} from "@/server/github/oauth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  const user = code
    ? await fetchGitHubUser(await exchangeGitHubCode(code))
    : demoGitHubUser();

  const response = NextResponse.redirect(new URL("/", appUrl));
  response.cookies.set(getSessionCookieName(), signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    path: "/",
  });
  return response;
}

export async function POST() {
  const response = NextResponse.json({ user: demoGitHubUser() });
  response.cookies.set(getSessionCookieName(), signSession(demoGitHubUser()), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
  return response;
}

