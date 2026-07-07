import { buildGitHubAuthorizeUrl } from "@/server/github/oauth";
import { rateLimit } from "@/server/api/rate-limit";
import { mobileGitHubOAuthConfigurationError } from "@/server/mobile/oauth-config";
import { createMobileAuthState } from "@/server/mobile/tokens";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, {
    bucket: "mobile-auth-start",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const configurationError = mobileGitHubOAuthConfigurationError();
  if (configurationError) {
    return NextResponse.json(
      {
        error: "github_oauth_not_configured",
        message: configurationError,
      },
      { status: 501 },
    );
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const redirectUri = new URL("/api/github/oauth/callback/mobile", appUrl).toString();
    const state = createMobileAuthState({
      platform: request.nextUrl.searchParams.get("platform"),
      label: request.nextUrl.searchParams.get("label") || "",
      callbackScheme: request.nextUrl.searchParams.get("callbackScheme") || "",
      codeChallenge: request.nextUrl.searchParams.get("codeChallenge") || "",
    });

    return NextResponse.redirect(buildGitHubAuthorizeUrl(state, { redirectUri }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid mobile auth request." },
      { status: 400 },
    );
  }
}
