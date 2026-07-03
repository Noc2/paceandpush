import { randomUUID } from "node:crypto";
import { buildGitHubAuthorizeUrl } from "@/server/github/oauth";
import { NextResponse } from "next/server";

export async function GET() {
  if (!process.env.GITHUB_CLIENT_ID) {
    return NextResponse.json(
      {
        error: "github_oauth_not_configured",
        message: "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable GitHub sign-in.",
      },
      { status: 501 },
    );
  }

  const response = NextResponse.redirect(buildGitHubAuthorizeUrl(randomUUID()));
  return response;
}

