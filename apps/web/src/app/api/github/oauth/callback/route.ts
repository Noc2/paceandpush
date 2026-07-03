import { getSessionCookieName, signSession } from "@/server/auth/session";
import { upsertGitHubAccount } from "@/server/data/accounts";
import {
  exchangeGitHubCode,
  fetchGitHubUser,
  githubOAuthStateCookieName,
} from "@/server/github/oauth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(githubOAuthStateCookieName)?.value;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Invalid GitHub OAuth callback." }, { status: 400 });
  }

  const token = await exchangeGitHubCode(code);
  const user = await upsertGitHubAccount({
    user: await fetchGitHubUser(token.accessToken),
    accessToken: token.accessToken,
    scopes: token.scopes,
  });

  const response = NextResponse.redirect(new URL("/", appUrl));
  response.cookies.delete(githubOAuthStateCookieName);
  response.cookies.set(getSessionCookieName(), signSession(user), {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    path: "/",
  });
  return response;
}
