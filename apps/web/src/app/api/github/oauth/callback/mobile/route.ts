import { upsertGitHubAccount } from "@/server/data/accounts";
import { createMobileAuthExchange } from "@/server/data/mobile";
import {
  recomputeScoreSnapshots,
  refreshPublicGitHubCommitsForUser,
} from "@/server/data/scores";
import {
  exchangeGitHubCode,
  fetchGitHubUser,
} from "@/server/github/oauth";
import { verifyMobileAuthState } from "@/server/mobile/tokens";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const redirectUri = new URL("/api/github/oauth/callback/mobile", appUrl).toString();

  try {
    if (!code || !state) {
      throw new Error("Invalid GitHub OAuth callback.");
    }

    const mobileState = verifyMobileAuthState(state);
    const token = await exchangeGitHubCode(code, { redirectUri });
    const user = await upsertGitHubAccount({
      user: await fetchGitHubUser(token.accessToken),
      accessToken: token.accessToken,
      scopes: token.scopes,
    });

    try {
      await refreshPublicGitHubCommitsForUser({
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
    const fallback = new URL("pacepush://auth/callback");
    fallback.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Invalid mobile auth callback.",
    );
    return NextResponse.redirect(fallback);
  }
}
