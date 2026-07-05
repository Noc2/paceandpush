import { buildGitHubAuthorizeUrl } from "@/server/github/oauth";
import { createMobileAuthState } from "@/server/mobile/tokens";
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
