import { randomUUID } from "node:crypto";
import {
  buildGitHubAuthorizeUrl,
  githubOAuthStateCookieName,
} from "@/server/github/oauth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  if (!process.env.GITHUB_CLIENT_ID) {
    return NextResponse.json(
      {
        error: "github_oauth_not_configured",
        message: "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable GitHub sign-in.",
      },
      { status: 501 },
    );
  }

  const state = randomUUID();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const redirectUri = new URL("/api/github/oauth/callback", appUrl).toString();
  const response = NextResponse.redirect(
    buildGitHubAuthorizeUrl(state, { redirectUri }),
  );
  response.cookies.set(githubOAuthStateCookieName, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    path: "/",
  });
  return response;
}
