import { getSessionCookieName, signSession } from "@/server/auth/session";
import { upsertGitHubAccount } from "@/server/data/accounts";
import {
  recomputeScoreSnapshots,
  refreshGitHubCommitsForUser,
} from "@/server/data/scores";
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
  const redirectUri = new URL("/api/github/oauth/callback", appUrl).toString();

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToSettingsWithGitHubError(appUrl, "invalid_callback");
  }

  try {
    const token = await exchangeGitHubCode(code, { redirectUri });
    const user = await upsertGitHubAccount({
      user: await fetchGitHubUser(token.accessToken),
      accessToken: token.accessToken,
      scopes: token.scopes,
    });

    try {
      await refreshGitHubCommitsForUser({
        accessToken: token.accessToken,
        userId: user.id,
        login: user.login,
      });
      await recomputeScoreSnapshots();
    } catch (error) {
      console.error("[github-oauth] initial score refresh failed", error);
    }

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
  } catch (error) {
    console.error("[github-oauth] callback failed", error);
    return redirectToSettingsWithGitHubError(appUrl, "connect_failed");
  }
}

function redirectToSettingsWithGitHubError(appUrl: string, code: string): NextResponse {
  const url = new URL("/settings", appUrl);
  url.searchParams.set("github", code);

  const response = NextResponse.redirect(url);
  response.cookies.delete(githubOAuthStateCookieName);
  return response;
}
