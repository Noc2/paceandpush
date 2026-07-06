import { buildGitHubAuthorizeUrl } from "@/server/github/oauth";
import { mobileGitHubOAuthConfigurationError } from "@/server/mobile/oauth-config";
import { createMobileAuthState } from "@/server/mobile/tokens";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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
    });

    return NextResponse.redirect(buildGitHubAuthorizeUrl(state, { redirectUri }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid mobile auth request." },
      { status: 400 },
    );
  }
}
