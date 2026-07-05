import type { SessionUser } from "@/server/auth/session";

const githubAuthorizeUrl = "https://github.com/login/oauth/authorize";
const githubTokenUrl = "https://github.com/login/oauth/access_token";
const githubUserUrl = "https://api.github.com/user";

export interface GitHubToken {
  accessToken: string;
  scopes: string[];
}

export const githubOAuthStateCookieName = "pace_push_oauth_state";

export function buildGitHubAuthorizeUrl(
  state: string,
  options: { redirectUri?: string } = {},
): URL {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("GITHUB_CLIENT_ID is required for GitHub OAuth");
  }

  const url = new URL(githubAuthorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "read:user");
  if (options.redirectUri) {
    url.searchParams.set("redirect_uri", options.redirectUri);
  }
  return url;
}

export async function exchangeGitHubCode(
  code: string,
  options: { redirectUri?: string } = {},
): Promise<GitHubToken> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth env vars are required to exchange a code");
  }

  const response = await fetch(githubTokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      ...(options.redirectUri ? { redirect_uri: options.redirectUri } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    scope?: string;
  };
  if (!payload.access_token) {
    throw new Error("GitHub token exchange did not return an access token");
  }

  return {
    accessToken: payload.access_token,
    scopes: payload.scope ? payload.scope.split(",").filter(Boolean) : [],
  };
}

export async function fetchGitHubUser(accessToken: string): Promise<SessionUser> {
  const response = await fetch(githubUserUrl, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "x-github-api-version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user fetch failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string | null;
  };

  return {
    githubId: String(payload.id),
    login: payload.login,
    displayName: payload.name || payload.login,
    avatarUrl: payload.avatar_url || null,
  };
}
