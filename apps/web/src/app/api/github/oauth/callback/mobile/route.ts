import { upsertGitHubAccount } from "@/server/data/accounts";
import { createMobileAuthExchange } from "@/server/data/mobile";
import {
  recomputeScoreSnapshots,
  refreshGitHubCommitsForUser,
} from "@/server/data/scores";
import {
  exchangeGitHubCode,
  fetchGitHubUser,
} from "@/server/github/oauth";
import { mobileGitHubCallbackErrorCode } from "@/server/mobile/callback-errors";
import { verifyMobileAuthState } from "@/server/mobile/tokens";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const redirectUri = new URL("/api/github/oauth/callback/mobile", appUrl).toString();
  let fallbackScheme = "pacepush";

  try {
    if (!code || !state) {
      throw new Error("Invalid GitHub OAuth callback.");
    }

    const mobileState = verifyMobileAuthState(state);
    fallbackScheme = mobileState.callbackScheme;
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
      console.error("[mobile-github-oauth] initial score refresh failed", error);
    }

    const callbackUrl = new URL(`${mobileState.callbackScheme}://auth/callback`);
    callbackUrl.searchParams.set(
      "code",
      await createMobileAuthExchange({
        userId: user.id,
        platform: mobileState.platform,
        label: mobileState.label,
      }),
    );
    return NextResponse.redirect(callbackUrl);
  } catch (error) {
    const errorCode = mobileGitHubCallbackErrorCode(error);
    console.error("[mobile-github-oauth] callback failed", {
      error,
      errorCode,
    });

    const fallback = new URL(`${fallbackScheme}://auth/callback`);
    fallback.searchParams.set("error", errorCode);
    return NextResponse.redirect(fallback);
  }
}
