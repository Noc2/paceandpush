import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

const contributions = await loadTypeScriptModule("../src/server/github/contributions.ts");
const mobileOauthConfig = await loadTypeScriptModule("../src/server/mobile/oauth-config.ts");
const mobileTokens = await loadTypeScriptModule("../src/server/mobile/tokens.ts");
const callbackErrors = await loadTypeScriptModule("../src/server/mobile/callback-errors.ts");
const oauth = await loadTypeScriptModule("../src/server/github/oauth.ts");
const payloads = await loadTypeScriptModule("../src/server/api/payloads.ts");
const periods = await loadTypeScriptModule("../src/lib/periods.ts");
const timelineTicks = await loadTypeScriptModule("../src/server/charts/timeline-ticks.ts");
const streaks = await loadTypeScriptModule("../src/lib/streaks.ts");
const tokenCrypto = await loadTypeScriptModule("../src/server/github/token-crypto.ts");

test("GitHub contribution windows cover each UTC date inclusively", () => {
  assert.deepEqual(
    plain(contributions.githubContributionDayWindows("2026-02-27", "2026-03-01")),
    [
      {
        day: "2026-02-27",
        from: "2026-02-27T00:00:00Z",
        to: "2026-02-27T23:59:59Z",
      },
      {
        day: "2026-02-28",
        from: "2026-02-28T00:00:00Z",
        to: "2026-02-28T23:59:59Z",
      },
      {
        day: "2026-03-01",
        from: "2026-03-01T00:00:00Z",
        to: "2026-03-01T23:59:59Z",
      },
    ],
  );
});

test("GitHub contribution fetch uses GraphQL day batches and includes restricted counts", async () => {
  const requests = [];
  const days = await contributions.fetchGitHubContributionDays({
    accessToken: "token",
    end: "2026-07-15",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://api.github.com/graphql");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.authorization, "Bearer token");

      const body = JSON.parse(init.body);
      assert.equal(body.variables.login, "Noc2");
      assert.match(body.query, /totalCommitContributions/);
      assert.match(body.query, /restrictedContributionsCount/);
      assert.doesNotMatch(body.query, /events\/public/);

      const aliases = [...body.query.matchAll(/d(\d+): contributionsCollection/g)];
      requests.push(aliases.length);

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            data: {
              user: Object.fromEntries(
                aliases.map((match) => {
                  const index = Number(match[1]);
                  return [
                    `d${index}`,
                    {
                      totalCommitContributions: index + 1,
                      restrictedContributionsCount: 10,
                    },
                  ];
                }),
              ),
            },
          };
        },
      };
    },
    login: "Noc2",
    start: "2026-07-01",
  });

  assert.deepEqual(requests, [14, 1]);
  assert.equal(days.length, 15);
  assert.deepEqual(plain(days[0]), {
    day: "2026-07-01",
    publicCommits: 1,
    restrictedContributions: 10,
    totalCount: 11,
  });
  assert.deepEqual(plain(days[14]), {
    day: "2026-07-15",
    publicCommits: 1,
    restrictedContributions: 10,
    totalCount: 11,
  });
});

test("GitHub contribution fetch retries transient GraphQL HTTP failures", async () => {
  let calls = 0;
  const days = await contributions.fetchGitHubContributionDays({
    accessToken: "token",
    end: "2026-07-01",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 502,
        };
      }

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            data: {
              user: {
                d0: {
                  totalCommitContributions: 3,
                  restrictedContributionsCount: 2,
                },
              },
            },
          };
        },
      };
    },
    login: "Noc2",
    retryDelayMs: 0,
    start: "2026-07-01",
  });

  assert.equal(calls, 2);
  assert.deepEqual(plain(days), [
    {
      day: "2026-07-01",
      publicCommits: 3,
      restrictedContributions: 2,
      totalCount: 5,
    },
  ]);
});

test("GitHub access tokens round-trip through encrypted storage format", () => {
  const previousKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "test-secret-with-at-least-thirty-two-characters";

  try {
    const encrypted = tokenCrypto.encryptGitHubAccessToken("gho_example");
    assert.notEqual(encrypted, "gho_example");
    assert.equal(tokenCrypto.decryptGitHubAccessToken(encrypted), "gho_example");
  } finally {
    if (previousKey === undefined) {
      delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.GITHUB_TOKEN_ENCRYPTION_KEY = previousKey;
    }
  }
});

test("GitHub OAuth authorize URL includes account picker prompt and explicit redirect URI", () => {
  const previousClientId = process.env.GITHUB_CLIENT_ID;
  process.env.GITHUB_CLIENT_ID = "github-client-id";

  try {
    const url = oauth.buildGitHubAuthorizeUrl("oauth-state", {
      redirectUri: "https://paceandpush.com/api/github/oauth/callback",
    });

    assert.equal(url.origin, "https://github.com");
    assert.equal(url.pathname, "/login/oauth/authorize");
    assert.equal(url.searchParams.get("client_id"), "github-client-id");
    assert.equal(url.searchParams.get("state"), "oauth-state");
    assert.equal(url.searchParams.get("scope"), "read:user");
    assert.equal(url.searchParams.get("prompt"), "select_account");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "https://paceandpush.com/api/github/oauth/callback",
    );
  } finally {
    restoreEnv("GITHUB_CLIENT_ID", previousClientId);
  }
});

test("GitHub user fetch includes GitHub error details", async () => {
  const oauthWithFetch = await loadTypeScriptModule("../src/server/github/oauth.ts", {
    fetch: async () => ({
      ok: false,
      status: 401,
      clone() {
        return this;
      },
      async json() {
        return { message: "Bad credentials" };
      },
    }),
  });

  await assert.rejects(
    () => oauthWithFetch.fetchGitHubUser("bad-token"),
    /GitHub user fetch failed with 401: Bad credentials/,
  );
});

test("mobile tokens require a dedicated production secret", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMobileSecret = process.env.MOBILE_TOKEN_SECRET;
  const previousSessionSecret = process.env.SESSION_SECRET;
  process.env.NODE_ENV = "production";
  delete process.env.MOBILE_TOKEN_SECRET;
  process.env.SESSION_SECRET = "session-secret-with-at-least-thirty-two-characters";

  try {
    assert.throws(
      () =>
        mobileTokens.createDeviceExchange({
          user: {
            githubId: "123",
            login: "octocat",
          },
          platform: "ios",
          label: "iPhone",
        }),
      /MOBILE_TOKEN_SECRET is required in production/,
    );

    process.env.MOBILE_TOKEN_SECRET = process.env.SESSION_SECRET;
    assert.throws(
      () =>
        mobileTokens.createDeviceExchange({
          user: {
            githubId: "123",
            login: "octocat",
          },
          platform: "ios",
          label: "iPhone",
        }),
      /MOBILE_TOKEN_SECRET must be distinct from SESSION_SECRET in production/,
    );
  } finally {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("MOBILE_TOKEN_SECRET", previousMobileSecret);
    restoreEnv("SESSION_SECRET", previousSessionSecret);
  }
});

test("mobile OAuth state binds platform callback scheme and PKCE challenge", () => {
  const previousMobileSecret = process.env.MOBILE_TOKEN_SECRET;
  process.env.MOBILE_TOKEN_SECRET = "mobile-secret-with-at-least-thirty-two";

  try {
    const verifier = "a".repeat(43);
    const codeChallenge = mobileTokens.codeChallengeForVerifier(verifier);
    const state = mobileTokens.createMobileAuthState({
      platform: "ios",
      label: "Test iPhone",
      callbackScheme: "pacepush",
      codeChallenge,
    });
    const payload = mobileTokens.verifyMobileAuthState(state);

    assert.equal(payload.platform, "ios");
    assert.equal(payload.callbackScheme, "pacepush");
    assert.equal(payload.codeChallenge, codeChallenge);
    assert.equal(payload.codeChallengeMethod, "S256");
    assert.throws(
      () =>
        mobileTokens.createMobileAuthState({
          platform: "ios",
          label: "Test iPhone",
          callbackScheme: "evilapp",
          codeChallenge,
        }),
      /Callback scheme is not allowed/,
    );
    assert.throws(
      () =>
        mobileTokens.createMobileAuthState({
          platform: "ios",
          label: "Test iPhone",
          callbackScheme: "pacepush",
          codeChallenge: "too-short",
        }),
      /Code challenge is invalid/,
    );
  } finally {
    restoreEnv("MOBILE_TOKEN_SECRET", previousMobileSecret);
  }
});

test("account deletion removes mobile auth exchanges before users", async () => {
  const source = await readFile(
    new URL("../src/server/data/accounts.ts", import.meta.url),
    "utf8",
  );
  const mobileExchangeDelete = source.indexOf("db.delete(mobileAuthExchanges)");
  const userDelete = source.indexOf("db.delete(users)");

  assert.notEqual(mobileExchangeDelete, -1);
  assert.notEqual(userDelete, -1);
  assert.ok(mobileExchangeDelete < userDelete);
});

test("mobile GitHub callback exposes safe error codes", async () => {
  assert.equal(
    callbackErrors.mobileGitHubCallbackErrorCode(new Error("Invalid GitHub OAuth callback.")),
    "github_callback_invalid",
  );
  assert.equal(
    callbackErrors.mobileGitHubCallbackErrorCode(new Error("Mobile auth state is invalid or expired.")),
    "github_connection_expired",
  );
  assert.equal(
    callbackErrors.mobileGitHubCallbackErrorCode(
      new Error('Failed query: insert into "mobile_auth_exchanges" params: secret'),
    ),
    "github_connection_failed",
  );
  assert.equal(
    callbackErrors.mobileAuthExchangeErrorMessage(
      new Error('Failed query: insert into "mobile_devices" params: secret'),
    ),
    "Could not finish GitHub device setup. Please try connecting GitHub again.",
  );
  assert.equal(
    callbackErrors.mobileAuthExchangeErrorMessage(new Error("Mobile auth code is invalid or expired.")),
    "GitHub sign-in expired. Please start GitHub connection again.",
  );
});

test("mobile GitHub start validates callback and exchange prerequisites", async () => {
  const previous = snapshotEnv([
    "DATABASE_URL",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_TOKEN_ENCRYPTION_KEY",
    "MOBILE_TOKEN_SECRET",
    "NODE_ENV",
    "POSTGRES_URL",
    "SESSION_SECRET",
  ]);

  try {
    delete process.env.DATABASE_URL;
    process.env.GITHUB_CLIENT_ID = "client";
    process.env.GITHUB_CLIENT_SECRET = "secret";
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    process.env.MOBILE_TOKEN_SECRET = "mobile-secret-with-at-least-thirty-two";
    process.env.NODE_ENV = "production";
    delete process.env.POSTGRES_URL;
    process.env.SESSION_SECRET = "session-secret-with-at-least-thirty-two";

    assert.match(
      mobileOauthConfig.mobileGitHubOAuthConfigurationError(),
      /DATABASE_URL or POSTGRES_URL/,
    );

    process.env.POSTGRES_URL = "postgres://example";
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "short";
    assert.match(
      mobileOauthConfig.mobileGitHubOAuthConfigurationError(),
      /GITHUB_TOKEN_ENCRYPTION_KEY must be at least 32 characters/,
    );

    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    process.env.MOBILE_TOKEN_SECRET = process.env.SESSION_SECRET;
    assert.match(
      mobileOauthConfig.mobileGitHubOAuthConfigurationError(),
      /MOBILE_TOKEN_SECRET must be distinct/,
    );

    process.env.MOBILE_TOKEN_SECRET = "mobile-secret-with-at-least-thirty-two";
    assert.equal(mobileOauthConfig.mobileGitHubOAuthConfigurationError(), null);
  } finally {
    restoreEnvSnapshot(previous);
  }
});

test("mobile auth routes require PKCE challenge and verifier", async () => {
  const startRoute = await readFile(
    new URL("../src/app/api/mobile/auth/github/start/route.ts", import.meta.url),
    "utf8",
  );
  const callbackRoute = await readFile(
    new URL("../src/app/api/github/oauth/callback/mobile/route.ts", import.meta.url),
    "utf8",
  );
  const exchangeRoute = await readFile(
    new URL("../src/app/api/mobile/auth/exchange/route.ts", import.meta.url),
    "utf8",
  );
  const mobileData = await readFile(
    new URL("../src/server/data/mobile.ts", import.meta.url),
    "utf8",
  );

  assert.match(startRoute, /codeChallenge/);
  assert.match(callbackRoute, /codeChallenge: mobileState\.codeChallenge/);
  assert.match(exchangeRoute, /body\.codeVerifier/);
  assert.match(mobileData, /const codeChallenge = codeChallengeForVerifier\(codeVerifier\)/);
  assert.match(
    mobileData,
    /eq\(mobileAuthExchanges\.codeChallenge, codeChallenge\)/,
  );
});

test("mobile auth applies an authoritative privacy choice before issuing a device token", async () => {
  const [accountsSource, callbackRoute, exchangeRoute, mobileData, tokenSource] =
    await Promise.all([
      readFile(new URL("../src/server/data/accounts.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../src/app/api/github/oauth/callback/mobile/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/app/api/mobile/auth/exchange/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../src/server/data/mobile.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/server/mobile/tokens.ts", import.meta.url), "utf8"),
    ]);

  assert.match(accountsSource, /publicLeaderboard: publicLeaderboard \?\? false/);
  assert.match(
    accountsSource,
    /\.\.\.\(typeof publicLeaderboard === "boolean" \? \{ publicLeaderboard \} : \{\}\)/,
  );

  const callbackPrivate = callbackRoute.indexOf("publicLeaderboard: false");
  const callbackRefresh = callbackRoute.lastIndexOf("await refreshGitHubCommitsForUser");
  assert.ok(callbackPrivate !== -1 && callbackPrivate < callbackRefresh);
  assert.match(callbackRoute, /invalidatePublicDiscoveryCache\(\)/);

  assert.match(exchangeRoute, /publicLeaderboard: body\.publicLeaderboard \?\? false/);
  assert.match(exchangeRoute, /typeof body\.publicLeaderboard !== "boolean"/);

  const persistDevice = mobileData.indexOf("await persistMobileDevice");
  const applyPreference = mobileData.indexOf("await applyMobileLeaderboardPreference");
  assert.ok(persistDevice !== -1 && persistDevice < applyPreference);
  assert.match(mobileData, /normalizedPlatform === "ios"\s+\? false/);
  assert.match(mobileData, /invalidatePublicDiscoveryCache\(\)/);
  assert.match(tokenSource, /publicLeaderboard: user\.publicLeaderboard/);
  assert.match(tokenSource, /publicActivityHistory: user\.publicActivityHistory/);
});

test("high-risk routes expose structured rate limits", async () => {
  const rateLimitSource = await readFile(
    new URL("../src/server/api/rate-limit.ts", import.meta.url),
    "utf8",
  );
  const routes = await Promise.all(
    [
      "../src/app/api/leaderboard/route.ts",
      "../src/app/api/search/users/route.ts",
      "../src/app/api/users/[login]/route.ts",
      "../src/app/api/embed/[login]/chart.svg/route.ts",
      "../src/app/api/mobile/auth/github/start/route.ts",
      "../src/app/api/mobile/auth/exchange/route.ts",
      "../src/app/api/mobile/devices/route.ts",
      "../src/app/api/mobile/pairing-codes/route.ts",
      "../src/app/api/mobile/distance-days/route.ts",
      "../src/app/api/me/github/refresh/route.ts",
    ].map(async (route) => [
      route,
      await readFile(new URL(route, import.meta.url), "utf8"),
    ]),
  );

  assert.match(rateLimitSource, /status: 429/);
  assert.match(rateLimitSource, /"retry-after"/);
  assert.match(rateLimitSource, /Too many requests\. Please retry later\./);
  for (const [route, source] of routes) {
    assert.match(source, /rateLimit\(request/, `${route} uses the rate limiter`);
  }
});

test("GitHub refresh has a per-user minimum interval", async () => {
  const route = await readFile(
    new URL("../src/app/api/me/github/refresh/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /githubRefreshMinimumIntervalMs = 15 \* 60 \* 1000/);
  assert.match(route, /minimumInterval\(/);
  assert.match(route, /`github-refresh:user:\$\{user\.id\}`/);
});

test("privacy export omits internal token and source hashes", async () => {
  const source = await readFile(
    new URL("../src/server/data/accounts.ts", import.meta.url),
    "utf8",
  );
  const exportBlock = source.slice(
    source.indexOf("export async function exportAccountData"),
    source.indexOf("export async function deleteAccountData"),
  );

  assert.doesNotMatch(exportBlock, /tokenHash/);
  assert.doesNotMatch(exportBlock, /sourceHash/);
  assert.doesNotMatch(exportBlock, /sourceMetadata/);
});

test("mobile account data routes use bearer auth", async () => {
  const exportRoute = await readFile(
    new URL("../src/app/api/mobile/me/privacy-export/route.ts", import.meta.url),
    "utf8",
  );
  const deleteRoute = await readFile(
    new URL("../src/app/api/mobile/me/delete/route.ts", import.meta.url),
    "utf8",
  );
  const nativeApp = await readFile(
    new URL("../../ios/PacePushApp.swift", import.meta.url),
    "utf8",
  );

  assert.match(exportRoute, /verifyDeviceToken\(request\.headers\.get\("authorization"\)\)/);
  assert.match(exportRoute, /exportAccountData\(auth\.user\.id\)/);
  assert.match(exportRoute, /"cache-control": "no-store"/);
  assert.doesNotMatch(exportRoute, /getSessionUser/);
  assert.match(deleteRoute, /verifyDeviceToken\(request\.headers\.get\("authorization"\)\)/);
  assert.match(deleteRoute, /getScoreSnapshotPeriodsForUser\(auth\.user\.id\)/);
  assert.match(deleteRoute, /deleteAccountData\(auth\.user\.id\)/);
  assert.match(deleteRoute, /recomputeScoreSnapshotPeriods\(affectedPeriods\)/);
  assert.doesNotMatch(deleteRoute, /getSessionUser/);
  assert.match(nativeApp, /settings-privacy-policy-link/);
  assert.match(nativeApp, /settings-export-data-button/);
  assert.match(nativeApp, /settings-delete-account-button/);
  assert.match(nativeApp, /\/api\/mobile\/me\/privacy-export/);
  assert.match(nativeApp, /\/api\/mobile\/me\/delete/);
});

test("web security headers are configured", async () => {
  const nextConfig = await readFile(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );
  for (const header of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ]) {
    assert.match(nextConfig, new RegExp(header));
  }
  assert.match(nextConfig, /object-src 'none'/);
});

test("Simple Analytics script is installed and allowed by CSP", async () => {
  const [layout, nextConfig] = await Promise.all([
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /id="simple-analytics"/);
  assert.match(layout, /https:\/\/scripts\.simpleanalyticscdn\.com\/latest\.js/);
  assert.match(nextConfig, /https:\/\/scripts\.simpleanalyticscdn\.com/);
  assert.match(nextConfig, /https:\/\/queue\.simpleanalyticscdn\.com/);
});

test("embed svg route has a sandboxed content security policy", async () => {
  const source = await readFile(
    new URL("../src/app/api/embed/[login]/chart.svg/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /content-security-policy/);
  assert.match(source, /default-src 'none'/);
  assert.match(source, /sandbox/);
  assert.match(source, /x-content-type-options/);
});

test("embed svg route accepts a GitHub theme parameter", async () => {
  const source = await readFile(
    new URL("../src/app/api/embed/[login]/chart.svg/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /parseProfileChartTheme/);
  assert.match(source, /searchParams\.get\("theme"\)/);
  assert.match(source, /renderProfileChartSvg\(profile, units, theme\)/);
});

test("embed svg brands the card and truncates the visible login", async () => {
  const source = await readFile(
    new URL("../src/server/charts/profile-chart.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /const visibleLogin = truncateSvgText\(profile\.login, 34\)/);
  assert.match(source, /\$\{escapeXml\(brandName\)\}<\/text>/);
  assert.match(source, /\$\{escapeXml\(visibleLogin\)\}<\/text>/);
  assert.doesNotMatch(source, /visibleDisplayName/);
  assert.match(source, /function truncateSvgText/);
});

test("embed svg includes a visible homepage link", async () => {
  const source = await readFile(
    new URL("../src/server/charts/profile-chart.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /const homepageUrl = "https:\/\/paceandpush\.com"/);
  assert.match(source, /const homepageLabel = "paceandpush\.com"/);
  assert.match(source, /<a href="\$\{homepageUrl\}"/);
  assert.match(source, /text-anchor="end"[\s\S]*fill="\$\{colors\.secondaryOrange\}"[\s\S]*\$\{escapeXml\(homepageLabel\)\}<\/text>/);
});

test("profile page generates clickable GitHub embed markdown", async () => {
  const source = await readFile(
    new URL("../src/app/users/[login]/page.tsx", import.meta.url),
    "utf8",
  );
  const docs = await readFile(
    new URL("../../../docs/github-profile-embed.md", import.meta.url),
    "utf8",
  );

  assert.ok(source.includes('const homepageUrl = "https://paceandpush.com/";'));
  assert.ok(
    source.includes(
      'const lightEmbedMarkdown = `[![${brandName} chart](https://paceandpush.com${lightChartPath})](${homepageUrl})`;',
    ),
  );
  assert.ok(
    source.includes(
      'const darkEmbedMarkdown = `[![${brandName} chart](https://paceandpush.com${darkChartPath})](${homepageUrl})`;',
    ),
  );
  assert.match(
    docs,
    /\[!\[Pace & Push chart\]\(https:\/\/paceandpush\.com\/api\/embed\/Noc2\/chart\.svg\?theme=light\)\]\(https:\/\/paceandpush\.com\/\)/,
  );
  assert.match(
    docs,
    /\[!\[Pace & Push chart\]\(https:\/\/paceandpush\.com\/api\/embed\/Noc2\/chart\.svg\?theme=dark\)\]\(https:\/\/paceandpush\.com\/\)/,
  );
});

test("profile page renders one theme-aware embed chart preview", async () => {
  const page = await readFile(
    new URL("../src/app/users/[login]/page.tsx", import.meta.url),
    "utf8",
  );
  const component = await readFile(
    new URL("../src/app/users/[login]/ProfileChartEmbed.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(page.includes("<ProfileChartEmbed"));
  assert.equal((component.match(/<object/g) ?? []).length, 0);
  assert.equal((component.match(/<img/g) ?? []).length, 1);
  assert.match(
    component,
    /const chartPath = resolvedTheme === "dark" \? darkChartPath : lightChartPath;/,
  );
  assert.match(
    component,
    /const embedMarkdown = resolvedTheme === "dark" \? darkEmbedMarkdown : lightEmbedMarkdown;/,
  );
  assert.match(component, /<img[\s\S]*className="profile-chart"[\s\S]*src=\{chartPath\}/);
  assert.doesNotMatch(component, /type="image\/svg\+xml"/);
  assert.match(
    component,
    /<p className="section-label">Profile chart<\/p>[\s\S]*<h2>Embed it on GitHub<\/h2>/,
  );
});

test("embed svg keeps long running-distance values inside the canvas", async () => {
  const source = await readFile(
    new URL("../src/server/charts/profile-chart.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /distanceX: chartWidth - 38 - 414/);
  assert.match(source, /metricText\(0, "Score"[\s\S]*colors\.secondaryOrange, colors\)/);
  assert.match(source, /metricText\(metrics\.distanceX,[\s\S]*colors\.rankBlue, colors, "end"\)/);
  assert.match(source, /dailyDistances = toDailyValues\(history\.map\(\(point\) => point\.kilometers\)\)/);
  assert.match(source, /buildMetricBars\(\{[\s\S]*values: dailyCommits[\s\S]*color: colors\.commitGreen/);
  assert.match(source, /buildMetricBars\(\{[\s\S]*values: dailyDistances[\s\S]*color: colors\.rankBlue/);
  assert.match(source, /<title>\$\{escapeXml\(title\(value, index\)\)\}<\/title>/);
  assert.match(source, /scoreHoverPoints\(history, maxScore\)/);
  assert.match(source, /pointer-events="all"/);
  assert.match(source, /profileTimelineTicks\(history\)/);
  assert.match(source, /font-weight="500"/);
  assert.match(source, /\{ label: "Score", color: "secondaryOrange" \}/);
  assert.match(source, /\{ label: "Run", color: "rankBlue" \}/);
  assert.match(source, /const seriesLegend = \[/);
  assert.match(source, /text-anchor="\$\{anchor\}"/);
});

test("profile chart timeline labels use calendar anchors for longer ranges", () => {
  const history = [
    "2026-01-01",
    "2026-01-15",
    "2026-02-01",
    "2026-03-01",
    "2026-04-01",
    "2026-05-01",
    "2026-06-01",
    "2026-07-01",
    "2026-07-08",
  ].map((date, index) => ({
    date,
    commits: index,
    kilometers: index,
    score: index,
  }));

  assert.deepEqual(
    plain(timelineTicks.profileTimelineTicks(history)).map(({ label, anchor }) => ({
      label,
      anchor,
    })),
    [
      { label: "01-01", anchor: "start" },
      { label: "02-01", anchor: "middle" },
      { label: "03-01", anchor: "middle" },
      { label: "04-01", anchor: "middle" },
      { label: "05-01", anchor: "middle" },
      { label: "06-01", anchor: "middle" },
      { label: "07-08", anchor: "end" },
    ],
  );
});

test("public snapshot refreshes are limited to current and previous periods", () => {
  const now = new Date("2026-07-06T12:00:00.000Z");

  assert.equal(periods.isCurrentOrPreviousPeriod("2026-07", now), true);
  assert.equal(periods.isCurrentOrPreviousPeriod("2026-06", now), true);
  assert.equal(periods.isCurrentOrPreviousPeriod("2026-05", now), false);
  assert.equal(periods.isCurrentOrPreviousPeriod("2026", now), true);
  assert.equal(periods.isCurrentOrPreviousPeriod("2025", now), true);
  assert.equal(periods.isCurrentOrPreviousPeriod("2024", now), false);
  assert.equal(periods.isCurrentOrPreviousPeriod("2026-W28", now), true);
  assert.equal(periods.isCurrentOrPreviousPeriod("2026-W27", now), true);
  assert.equal(periods.isCurrentOrPreviousPeriod("2026-W26", now), false);
});

test("streak calculation counts unique consecutive active days", () => {
  assert.equal(streaks.calculateStreakDays([]), 0);
  assert.equal(
    streaks.calculateStreakDays([
      "2026-07-05",
      "2026-07-04",
      "2026-07-04",
      "2026-07-03",
      "2026-07-01",
    ]),
    3,
  );
});

test("leaderboard streaks are loaded in batched queries and ignore zero-count commit coverage rows", async () => {
  const source = await readFile(
    new URL("../src/server/data/read-model.ts", import.meta.url),
    "utf8",
  );
  const toRowsBlock = source.slice(
    source.indexOf("async function toLeaderboardRows"),
    source.indexOf("export async function getPublicProfile"),
  );

  assert.match(toRowsBlock, /getStreakDaysByUserId/);
  assert.doesNotMatch(toRowsBlock, /rows\.map\(async/);
  assert.match(source, /inArray\(commitDays\.userId, uniqueUserIds\)/);
  assert.match(source, /gt\(commitDays\.commitCount, 0\)/);
  assert.match(source, /inArray\(distanceDays\.userId, uniqueUserIds\)/);
});

test("public leaderboard rows are capped", async () => {
  const source = await readFile(
    new URL("../src/server/data/read-model.ts", import.meta.url),
    "utf8",
  );
  const leaderboardQuery = source.slice(
    source.indexOf("async function getLeaderboardSnapshotRows"),
    source.indexOf("async function getPublicUserSearchRows"),
  );

  assert.match(source, /const leaderboardRowLimit = 100/);
  assert.match(leaderboardQuery, /\.limit\(leaderboardRowLimit\)/);
});

test("public discovery responses bypass caches so consent withdrawal is immediate", async () => {
  const [cacheSource, leaderboardRoute, searchRoute] = await Promise.all([
    readFile(
      new URL("../src/server/data/public-discovery-cache.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/app/api/leaderboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/search/users/route.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(cacheSource, /unstable_cache|revalidateTag|revalidate:/);
  assert.match(cacheSource, /return getLeaderboard\(board, period\)/);
  assert.match(cacheSource, /return searchPublicUsers\(\{ limit, period, query \}\)/);
  assert.match(leaderboardRoute, /getCachedLeaderboard\(board, period\)/);
  assert.match(searchRoute, /searchCachedPublicUsers\(\{ limit, period, query \}\)/);
  for (const route of [leaderboardRoute, searchRoute]) {
    assert.match(route, /"cache-control": "no-store"/);
    assert.doesNotMatch(route, /s-maxage|stale-while-revalidate/);
  }
});

test("anonymous health-derived surfaces require current consent and gate dated history", async () => {
  const [consentSource, readModel, scoreSource] = await Promise.all([
    readFile(
      new URL("../src/server/privacy/public-health-data-consent.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/server/data/read-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/server/data/scores.ts", import.meta.url), "utf8"),
  ]);

  assert.match(consentSource, /currentPublicHealthDataConsentVersion = "public-health-v1"/);
  assert.match(consentSource, /isNotNull\(users\.publicHealthDataConsentedAt\)/);
  assert.match(consentSource, /isNull\(users\.publicHealthDataConsentRevokedAt\)/);
  assert.ok(
    readModel.match(/currentPublicHealthDataConsentCondition\(\)/g)?.length >= 3,
    "leaderboard, search, and public profiles all require current consent",
  );
  assert.match(
    readModel,
    /history: user\.publicActivityHistory[\s\S]*\? await getProfileHistory[\s\S]*: \[\]/,
  );
  assert.match(
    readModel,
    /historyVisibility: user\.publicActivityHistory \? "public" : "private"/,
  );
  assert.match(scoreSource, /const publicTotals = totals\.filter\(\(row\) => row\.publicLeaderboard\)/);
  assert.match(scoreSource, /hasCurrentPublicHealthDataConsent\(user\)/);
  assert.match(scoreSource, /scoreCohort\(\[\.\.\.publicTotals, row\]\)/);
});

test("leaderboard visibility defaults and existing accounts reset to private", async () => {
  const [schemaSource, accountsSource, migrationSource, embedRoute] = await Promise.all([
    readFile(new URL("../src/server/db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/server/data/accounts.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0012_private_leaderboard_default.sql", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/api/embed/[login]/chart.svg/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    schemaSource,
    /publicLeaderboard: boolean\("public_leaderboard"\)\.notNull\(\)\.default\(false\)/,
  );
  assert.match(accountsSource, /publicLeaderboard: publicLeaderboard \?\? false,/);
  assert.match(migrationSource, /ALTER COLUMN public_leaderboard SET DEFAULT false/);
  assert.match(migrationSource, /UPDATE users\s+SET public_leaderboard = false/);
  assert.doesNotMatch(migrationSource, /SET public_leaderboard = true/);
  assert.match(embedRoute, /"cache-control": "no-store"/);
  assert.doesNotMatch(embedRoute, /s-maxage|stale-while-revalidate/);
});

test("public health-data publication requires current versioned consent", async () => {
  const [schemaSource, migrationSource, payloadSource, accountsSource, webRoute, mobileRoute] =
    await Promise.all([
      readFile(new URL("../src/server/db/schema.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../drizzle/0013_public_health_data_consent.sql", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../src/server/api/payloads.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/server/data/accounts.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/app/api/me/settings/route.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../src/app/api/mobile/me/settings/route.ts", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(schemaSource, /publicActivityHistory: boolean\("public_activity_history"\)/);
  assert.match(schemaSource, /publicHealthDataConsentVersion: text\("public_health_data_consent_version"\)/);
  assert.match(migrationSource, /public_activity_history boolean NOT NULL DEFAULT false/);
  assert.match(migrationSource, /public_health_data_consent_required/);
  assert.match(migrationSource, /NOT public_activity_history OR public_leaderboard/);
  assert.match(migrationSource, /UPDATE users[\s\S]*public_leaderboard = false/);
  assert.match(payloadSource, /value\.version === currentPublicHealthDataConsentVersion/);
  assert.match(payloadSource, /value\.publishExactPeriodKilometers === true/);
  assert.match(accountsSource, /publicHealthDataConsent\.publicActivityHistory/);
  assert.match(accountsSource, /publicHealthDataConsentVersion: publicHealthDataConsent\.version/);
  assert.match(accountsSource, /publicLeaderboard === true && !hasCurrentConsent/);
  assert.match(accountsSource, /publicLeaderboard: false,[\s\S]*publicActivityHistory: false/);

  for (const route of [webRoute, mobileRoute]) {
    assert.match(route, /publicHealthDataConsent: body\.publicHealthDataConsent/);
    assert.match(route, /publicActivityHistory: updatedUser\.publicActivityHistory/);
    assert.match(route, /publicHealthDataConsentVersion: updatedUser\.publicHealthDataConsentVersion/);
  }
});

test("privacy changes and account deletion purge public discovery data", async () => {
  const routes = await Promise.all(
    [
      "../src/app/api/me/settings/route.ts",
      "../src/app/api/mobile/me/settings/route.ts",
      "../src/app/api/me/delete/route.ts",
      "../src/app/api/mobile/me/delete/route.ts",
    ].map((route) => readFile(new URL(route, import.meta.url), "utf8")),
  );

  for (const source of routes) {
    assert.match(source, /invalidatePublicDiscoveryCache\(\)/);
  }

  for (const source of routes.slice(0, 2)) {
    assert.ok(
      source.indexOf("updateAccountSettings") <
        source.lastIndexOf("invalidatePublicDiscoveryCache()"),
    );
    assert.ok(
      source.lastIndexOf("invalidatePublicDiscoveryCache()") <
        source.indexOf("await refreshScoresAfterLeaderboardVisibilityChange"),
    );
  }

  for (const source of routes.slice(2)) {
    assert.ok(
      source.indexOf("await deleteAccountData") <
        source.lastIndexOf("invalidatePublicDiscoveryCache()"),
    );
    assert.ok(
      source.lastIndexOf("invalidatePublicDiscoveryCache()") <
        source.indexOf("await recomputeScoreSnapshotPeriods"),
    );
  }
});

test("GitHub commit refresh upserts covered days before deleting stale days", async () => {
  const source = await readFile(
    new URL("../src/server/data/scores.ts", import.meta.url),
    "utf8",
  );
  const refreshBlock = source.slice(
    source.indexOf("export async function refreshGitHubCommitsForUser"),
    source.indexOf("export async function recomputeScoreSnapshots"),
  );

  const insertIndex = refreshBlock.indexOf(".insert(commitDays)");
  const deleteIndex = refreshBlock.indexOf(".delete(commitDays)");
  assert.notEqual(insertIndex, -1);
  assert.notEqual(deleteIndex, -1);
  assert.ok(insertIndex < deleteIndex);
  assert.match(refreshBlock, /contributionRefreshEnd\(start, periodEnd\)/);
  assert.match(refreshBlock, /dayCounts\.map\(\(day\) =>/);
  assert.match(refreshBlock, /commitCount: day\.totalCount/);
  assert.doesNotMatch(refreshBlock, /activeDays\.map/);
  assert.match(refreshBlock, /notInArray\(commitDays\.day/);
  assert.match(refreshBlock, /updatedDays: dayCounts\.length/);
});

test("score rank mutations recompute every affected snapshot period", async () => {
  const scoresSource = await readFile(
    new URL("../src/server/data/scores.ts", import.meta.url),
    "utf8",
  );
  const deleteRoute = await readFile(
    new URL("../src/app/api/me/delete/route.ts", import.meta.url),
    "utf8",
  );
  const disconnectRoute = await readFile(
    new URL("../src/app/api/me/github/disconnect/route.ts", import.meta.url),
    "utf8",
  );
  const visibilityBlock = scoresSource.slice(
    scoresSource.indexOf("export async function refreshScoresAfterLeaderboardVisibilityChange"),
    scoresSource.indexOf("async function getScoreTotals"),
  );

  assert.match(scoresSource, /export async function getScoreSnapshotPeriodsForUser/);
  assert.match(scoresSource, /export async function recomputeScoreSnapshotPeriods/);
  assert.match(visibilityBlock, /getScoreSnapshotPeriodsForUser\(userId, \[period\]\)/);
  assert.match(visibilityBlock, /recomputeScoreSnapshotPeriods\(affectedPeriods\)/);

  assert.ok(
    deleteRoute.indexOf("getScoreSnapshotPeriodsForUser(user.id)") <
      deleteRoute.indexOf("deleteAccountData(user.id)"),
  );
  assert.ok(
    deleteRoute.indexOf("deleteAccountData(user.id)") <
      deleteRoute.indexOf("recomputeScoreSnapshotPeriods(affectedPeriods)"),
  );
  assert.ok(
    disconnectRoute.indexOf("getScoreSnapshotPeriodsForUser(user.id") <
      disconnectRoute.indexOf("disconnectGitHubAccount(user.id)"),
  );
  assert.ok(
    disconnectRoute.indexOf("disconnectGitHubAccount(user.id)") <
      disconnectRoute.indexOf("recomputeScoreSnapshotPeriods(affectedPeriods)"),
  );
});

test("score recomputes coalesce in-progress period work", async () => {
  const scoresSource = await readFile(
    new URL("../src/server/data/scores.ts", import.meta.url),
    "utf8",
  );

  assert.match(scoresSource, /const recomputeInFlight = new Map/);
  assert.match(scoresSource, /const existing = recomputeInFlight\.get\(period\)/);
  assert.match(scoresSource, /if \(existing\) return existing/);
  assert.match(scoresSource, /recomputeScoreSnapshotsUnlocked/);
  assert.match(scoresSource, /recomputeInFlight\.delete\(period\)/);
});

test("mobile GitHub sign-out revokes social credentials and device access", async () => {
  const route = await readFile(
    new URL("../src/app/api/mobile/me/github/disconnect/route.ts", import.meta.url),
    "utf8",
  );
  const nativeApp = await readFile(
    new URL("../../ios/PacePushApp.swift", import.meta.url),
    "utf8",
  );

  assert.match(route, /verifyDeviceToken\(request\.headers\.get\("authorization"\)\)/);
  assert.match(route, /disconnectGitHubAccount\(auth\.user\.id\)/);
  assert.match(route, /revokeMobileDevice\(\{ id: auth\.device\.id, userId: auth\.user\.id \}\)/);
  assert.match(route, /recomputeScoreSnapshotPeriods\(affectedPeriods\)/);
  assert.match(nativeApp, /settings-sign-out-button/);
  assert.match(nativeApp, /\/api\/mobile\/me\/github\/disconnect/);
});

test("authenticated profile reads repair partially covered historical commit snapshots", async () => {
  const source = await readFile(
    new URL("../src/server/data/read-model.ts", import.meta.url),
    "utf8",
  );
  const profileBlock = source.slice(
    source.indexOf("export async function getAccountProfile"),
    source.indexOf("export async function getMe"),
  );
  const refreshBlock = source.slice(
    source.indexOf("async function getFreshAccountScoreSummary"),
    source.indexOf("async function hasScoreSnapshot"),
  );

  assert.match(profileBlock, /getFreshAccountScoreSummary\(\{ id: userId, login \}, period\)/);
  assert.match(refreshBlock, /shouldRefreshAccountScoreSnapshot\(account\.id, period\)/);
  assert.match(refreshBlock, /refreshGitHubCommitsForUser/);
  assert.match(refreshBlock, /recomputeScoreSnapshots\(period\)/);
  assert.match(refreshBlock, /hasCompleteCommitCoverage\(userId, period\)/);
  assert.match(refreshBlock, /expectedCommitCoverageDays\(start, end\)/);
  assert.match(refreshBlock, /count\(\*\)::int/);
  assert.doesNotMatch(refreshBlock, /isCurrentOrPreviousPeriod\(period\)/);
  assert.doesNotMatch(refreshBlock, /snapshot\.commits === 0/);
});

test("score totals keep raw kilometer precision before display rounding", async () => {
  const source = await readFile(
    new URL("../src/server/data/scores.ts", import.meta.url),
    "utf8",
  );
  const totalsBlock = source.slice(
    source.indexOf("async function getScoreTotals"),
    source.indexOf("function compareBoardRows"),
  );

  assert.match(totalsBlock, /kilometers: \(metersByUser\.get\(user\.id\) \?\? 0\) \/ 1000/);
  assert.doesNotMatch(totalsBlock, /Math\.round/);
});

test("score recompute cron reports hard failures to monitoring", async () => {
  const source = await readFile(
    new URL("../src/app/api/jobs/recompute-scores/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /export const maxDuration = \d+/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /status: totalGitHubFailure \? 502 : 200/);
  assert.match(source, /status: 500/);
});

test("health endpoint checks database availability", async () => {
  const source = await readFile(
    new URL("../src/app/api/health/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /select 1/);
  assert.match(source, /isDatabaseConfigured/);
  assert.match(source, /cache-control": "no-store"/);
  assert.match(source, /503/);
});

test("authenticated mobile profile responses are not cached", async () => {
  const mobileMeRoute = await readFile(
    new URL("../src/app/api/mobile/me/route.ts", import.meta.url),
    "utf8",
  );
  const mobileProfileRoute = await readFile(
    new URL("../src/app/api/mobile/me/profile/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(mobileMeRoute, /"cache-control": "no-store"/);
  assert.match(mobileProfileRoute, /"cache-control": "no-store"/);
});

test("distance uploads recompute week month and year score periods", async () => {
  const source = await readFile(
    new URL("../src/app/api/mobile/distance-days/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /periodForKind\("week"/);
  assert.match(source, /periodForKind\("month"/);
  assert.match(source, /periodForKind\("year"/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /score_recompute_failed/);
});

test("distance upload validation rejects malformed items and impossible dates", () => {
  const validDay = {
    date: "2026-02-28",
    meters: 10_000,
    sourcePlatform: "ios",
    sourceHash: "healthkit-ios-running-2026-02-28-10000",
  };

  assert.equal(payloads.isDistanceDayInput(validDay, "ios"), true);
  assert.equal(
    payloads.isDistanceDayInput({ ...validDay, date: "2026-02-31" }, "ios"),
    false,
  );
  assert.equal(payloads.isDistanceDayInput(null, "ios"), false);
  assert.equal(payloads.isDistanceDayInput({ ...validDay, sourcePlatform: "android" }, "ios"), false);
});

test("mutating JSON payload validators reject non-object bodies", () => {
  assert.equal(payloads.isAccountSettingsPatch({ publicLeaderboard: true }), true);
  assert.equal(payloads.isAccountSettingsPatch(null), false);
  assert.equal(payloads.isAccountSettingsPatch([]), false);

  assert.equal(
    payloads.isSyncRunRequest(
      {
        platform: "ios",
        status: "success",
        startedAt: "2026-07-06T12:00:00.000Z",
        counters: { days: 1 },
      },
      "ios",
    ),
    true,
  );
  assert.equal(payloads.isSyncRunRequest(null, "ios"), false);
  assert.equal(
    payloads.isSyncRunRequest(
      {
        platform: "ios",
        status: "success",
        startedAt: "2026-07-06T12:00:00.000Z",
        counters: [],
      },
      "ios",
    ),
    false,
  );
});

test("distance uploads are canonical by day instead of source hash", async () => {
  const routeSource = await readFile(
    new URL("../src/app/api/mobile/distance-days/route.ts", import.meta.url),
    "utf8",
  );
  const schemaSource = await readFile(
    new URL("../src/server/db/schema.ts", import.meta.url),
    "utf8",
  );
  const migrationSource = await readFile(
    new URL("../drizzle/0008_distance_source_hash_lookup.sql", import.meta.url),
    "utf8",
  );

  assert.match(routeSource, /canonicalDistanceDays/);
  assert.match(routeSource, /daysByDate\.set\(day\.date, day\)/);
  assert.match(schemaSource, /sourceHashIdx: index\("distance_days_user_source_hash_idx"\)/);
  assert.doesNotMatch(schemaSource, /sourceHashIdx: uniqueIndex/);
  assert.match(migrationSource, /DROP INDEX IF EXISTS distance_days_user_source_hash_idx/);
  assert.match(migrationSource, /CREATE INDEX IF NOT EXISTS distance_days_user_source_hash_idx/);
});

test("settings exposes a logout control that clears the session cookie", async () => {
  const routeSource = await readFile(
    new URL("../src/app/api/auth/logout/route.ts", import.meta.url),
    "utf8",
  );
  const pageSource = await readFile(
    new URL("../src/app/settings/page.tsx", import.meta.url),
    "utf8",
  );
  const controlSource = await readFile(
    new URL("../src/app/settings/SignOutControl.tsx", import.meta.url),
    "utf8",
  );

  assert.match(routeSource, /response\.cookies\.delete\(getSessionCookieName\(\)\)/);
  assert.match(pageSource, /<SignOutControl \/>/);
  assert.match(controlSource, /fetch\("\/api\/auth\/logout", \{ method: "POST" \}\)/);
});

test("web public health sharing requires explicit versioned consent", async () => {
  const pageSource = await readFile(
    new URL("../src/app/settings/page.tsx", import.meta.url),
    "utf8",
  );
  const controlSource = await readFile(
    new URL("../src/app/settings/LeaderboardVisibilityControl.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pageSource, /initialPublicActivityHistory=\{me\.publicActivityHistory\}/);
  assert.match(
    pageSource,
    /initialPublicHealthDataConsentVersion=\{me\.publicHealthDataConsentVersion\}/,
  );
  assert.match(
    pageSource,
    /initialPublicHealthDataConsentedAt=\{me\.publicHealthDataConsentedAt\}/,
  );
  assert.match(controlSource, /anyone on the internet/);
  assert.match(controlSource, /without a Pace &amp;[\s\S]*Push account/);
  assert.match(controlSource, /GitHub login, display name, bio, and last sync time/);
  assert.match(controlSource, /exact running distance in kilometers/);
  assert.match(controlSource, /commit total, combined score, leaderboard rank, and streak/);
  assert.match(controlSource, /copy,[\s\S]*save, or share/);
  assert.match(controlSource, /Also publish dated activity history/);
  assert.match(controlSource, /Off by default/);
  assert.match(controlSource, /version: publicHealthDataConsentVersion/);
  assert.match(controlSource, /publishExactPeriodKilometers: true/);
  assert.match(controlSource, /publicActivityHistory: includeHistory/);
  assert.match(
    controlSource,
    /body: JSON\.stringify\(\{ publicLeaderboard: false \}\)/,
  );
  assert.doesNotMatch(controlSource, /setSharing\([\s\S]{0,250}fetch\("\/api\/me\/settings"/);
  assert.match(controlSource, /The server did not confirm withdrawal/);
});

test("public profiles explain when dated activity history remains private", async () => {
  const profileSource = await readFile(
    new URL("../src/app/users/[login]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(profileSource, /profile\.historyVisibility === "public"/);
  assert.match(
    profileSource,
    /profile\.historyVisibility === "public"[\s\S]*<ProfileChartEmbed/,
  );
  assert.match(profileSource, /history is private/);
  assert.match(profileSource, /has not chosen to publish dated[\s\S]*activity history/);
});

test("manual mobile pairing codes are database backed and single use", async () => {
  const pairingRoute = await readFile(
    new URL("../src/app/api/mobile/pairing-codes/route.ts", import.meta.url),
    "utf8",
  );
  const devicesRoute = await readFile(
    new URL("../src/app/api/mobile/devices/route.ts", import.meta.url),
    "utf8",
  );
  const mobileData = await readFile(
    new URL("../src/server/data/mobile.ts", import.meta.url),
    "utf8",
  );
  const tokenSource = await readFile(
    new URL("../src/server/mobile/tokens.ts", import.meta.url),
    "utf8",
  );

  assert.match(pairingRoute, /createMobilePairingCode/);
  assert.match(devicesRoute, /exchangeMobilePairingCode/);
  assert.match(mobileData, /code = `pp_pair\.\$\{randomBytes/);
  assert.match(mobileData, /isNull\(mobileAuthExchanges\.consumedAt\)/);
  assert.match(mobileData, /set\(\{[\s\S]*consumedAt: now/);
  assert.doesNotMatch(tokenSource, /function verifyPairingToken/);
});

test("GitHub login lookup allows username recycling", async () => {
  const schemaSource = await readFile(
    new URL("../src/server/db/schema.ts", import.meta.url),
    "utf8",
  );
  const migrationSource = await readFile(
    new URL("../drizzle/0010_login_lookup_index.sql", import.meta.url),
    "utf8",
  );
  const readModelSource = await readFile(
    new URL("../src/server/data/read-model.ts", import.meta.url),
    "utf8",
  );

  assert.match(schemaSource, /loginIdx: index\("users_login_idx"\)/);
  assert.doesNotMatch(schemaSource, /loginIdx: uniqueIndex\("users_login_idx"\)/);
  assert.match(migrationSource, /DROP INDEX IF EXISTS users_login_idx/);
  assert.match(readModelSource, /orderBy\(desc\(users\.updatedAt\)\)/);
});

test("production runtime validates required environment variables", async () => {
  const nextConfig = await readFile(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );
  const envExample = await readFile(new URL("../../../.env.example", import.meta.url), "utf8");
  const dbClient = await readFile(
    new URL("../src/server/db/client.ts", import.meta.url),
    "utf8",
  );
  const session = await readFile(
    new URL("../src/server/auth/session.ts", import.meta.url),
    "utf8",
  );
  const mobileTokens = await readFile(
    new URL("../src/server/mobile/tokens.ts", import.meta.url),
    "utf8",
  );
  const cronJob = await readFile(
    new URL("../src/app/api/jobs/recompute-scores/route.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(nextConfig, /assertProductionEnv/);
  assert.match(dbClient, /DATABASE_URL or POSTGRES_URL is required/);
  assert.match(session, /SESSION_SECRET is required in production/);
  assert.match(mobileTokens, /MOBILE_TOKEN_SECRET is required in production/);
  assert.match(mobileTokens, /MOBILE_TOKEN_SECRET must be distinct/);
  assert.match(cronJob, /process\.env\.CRON_SECRET/);
  assert.match(envExample, /NEXT_PUBLIC_APP_URL=/);
  assert.match(envExample, /NEXT_PUBLIC_IOS_APP_URL=/);
  assert.match(envExample, /NEXT_PUBLIC_ANDROID_APP_URL=/);
  assert.match(envExample, /POSTGRES_URL=/);
  assert.match(envExample, /CRON_SECRET=/);
});

test("production Vercel builds run database migrations before building", async () => {
  const packageJson = await readFile(new URL("../../../package.json", import.meta.url), "utf8");
  const vercelJson = await readFile(new URL("../../../vercel.json", import.meta.url), "utf8");
  const buildScript = await readFile(
    new URL("../../../scripts/vercel-build.mjs", import.meta.url),
    "utf8",
  );

  assert.match(packageJson, /"vercel:build": "node scripts\/vercel-build\.mjs"/);
  assert.match(packageJson, /"legal:check": "node scripts\/check-legal\.mjs"/);
  assert.match(packageJson, /"build": "npm run legal:check && npm run build:web"/);
  assert.match(vercelJson, /"buildCommand": "npm run vercel:build"/);
  assert.match(buildScript, /process\.env\.VERCEL_ENV === "production"/);
  assert.ok(buildScript.indexOf("\"legal:check\"") < buildScript.indexOf("\"db:migrations:check\""));
  assert.ok(buildScript.indexOf("\"db:migrations:check\"") < buildScript.indexOf("\"db:migrate\""));
  assert.ok(buildScript.indexOf("\"db:migrate\"") < buildScript.indexOf("\"build:web\""));
  assert.doesNotMatch(buildScript, /\["run", "build"\]/);
});

test("web layout consumes shared brand CSS variables", async () => {
  const layoutSource = await readFile(
    new URL("../src/app/layout.tsx", import.meta.url),
    "utf8",
  );
  const themeControlSource = await readFile(
    new URL("../src/app/ThemePreferenceControl.tsx", import.meta.url),
    "utf8",
  );
  const globalCss = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(layoutSource, /import \{ cssVariables \} from "@paceandpush\/brand"/);
  assert.match(layoutSource, /localStorage\.getItem\("pace-theme"\)/);
  assert.match(layoutSource, /document\.documentElement\.dataset\.theme = theme/);
  assert.match(layoutSource, /dangerouslySetInnerHTML=\{\{ __html: cssVariables \}\}/);
  assert.match(themeControlSource, /const preferences: SelectableThemePreference\[] = \["light", "dark"\]/);
  assert.match(themeControlSource, /window\.addEventListener\("pace-theme-change", syncPreference\)/);
  assert.match(themeControlSource, /window\.removeEventListener\("pace-theme-change", syncPreference\)/);
  assert.match(globalCss, /grid-template-columns: repeat\(2, minmax\(78px, 1fr\)\)/);
  assert.match(globalCss, /\.metric-score \{[\s\S]*color: var\(--score\)/);
  assert.match(globalCss, /\.metric-distance \{[\s\S]*color: var\(--distance\)/);
  assert.doesNotMatch(globalCss, /^:root \{/m);
});

test("homepage has accessible heading cells and app download actions", async () => {
  const pageSource = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const downloadActionsSource = await readFile(
    new URL("../src/app/AppDownloadActions.tsx", import.meta.url),
    "utf8",
  );
  const globalCss = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(pageSource, /<h1 className="sr-only">Pace & Push leaderboard<\/h1>/);
  assert.match(pageSource, /<AppDownloadActions \/>/);
  assert.doesNotMatch(pageSource, /href="\/settings"/);
  assert.doesNotMatch(pageSource, /Mobile apps/);
  assert.match(downloadActionsSource, /NEXT_PUBLIC_IOS_APP_URL/);
  assert.match(downloadActionsSource, /NEXT_PUBLIC_ANDROID_APP_URL/);
  assert.match(downloadActionsSource, /id: "android",[\s\S]*disabled: true/);
  assert.match(downloadActionsSource, /disabled=\{target\.disabled\}/);
  assert.match(downloadActionsSource, /QRCode\.toDataURL/);
  assert.match(pageSource, /role="cell"/);
  assert.match(globalCss, /\.sr-only/);
  assert.match(globalCss, /\.download-modal/);
});

test("sync run validation accepts omitted finishedAt and null errorSummary", async () => {
  const payloadSource = await readFile(
    new URL("../src/server/api/payloads.ts", import.meta.url),
    "utf8",
  );
  const contractSource = await readFile(
    new URL("../../../packages/api-contracts/src/types.ts", import.meta.url),
    "utf8",
  );

  assert.match(payloadSource, /value\.finishedAt == null/);
  assert.match(payloadSource, /value\.errorSummary == null/);
  assert.match(contractSource, /finishedAt\?: string \| null/);
  assert.match(contractSource, /errorSummary\?: string \| null/);
});

test("native API base URL editing is debug-only", async () => {
  const iosSource = await readFile(
    new URL("../../ios/PacePushApp.swift", import.meta.url),
    "utf8",
  );
  const androidSource = await readFile(
    new URL("../../android/app/src/main/java/com/paceandpush/MainActivity.kt", import.meta.url),
    "utf8",
  );

  assert.match(iosSource, /var showsServerSettings: Bool/);
  assert.match(iosSource, /#if DEBUG[\s\S]*true[\s\S]*#else[\s\S]*false[\s\S]*#endif/);
  assert.match(iosSource, /allowsAPIBaseURLOverride \? pairing\.baseURL : nil/);
  assert.match(androidSource, /ApplicationInfo\.FLAG_DEBUGGABLE/);
  assert.match(androidSource, /if \(allowsApiBaseUrlOverride\(\)\)/);
  assert.match(androidSource, /DEFAULT_API_BASE_URL/);
});

test("iOS app keeps system default while exposing light and dark theme choices", async () => {
  const iosSource = await readFile(
    new URL("../../ios/PacePushApp.swift", import.meta.url),
    "utf8",
  );

  assert.match(iosSource, /enum BrandThemePreference: String, CaseIterable, Identifiable/);
  assert.match(iosSource, /case system/);
  assert.match(iosSource, /case light/);
  assert.match(iosSource, /case dark/);
  assert.match(iosSource, /\.preferredColorScheme\(store\.themePreference\.colorScheme\)/);
  assert.doesNotMatch(iosSource, /\.preferredColorScheme\(\.light\)/);
  assert.match(iosSource, /SettingsSectionPanel\("Theme"\)/);
  assert.doesNotMatch(iosSource, /SettingsSectionPanel\("Appearance"\)/);
  assert.doesNotMatch(iosSource, /SettingsSectionPanel\("Account"\)/);
  assert.doesNotMatch(iosSource, /StatusRow\(label: "Developer"/);
  assert.match(iosSource, /SettingsThemeSelector\(themePreference: \$store\.themePreference\)/);
  assert.match(iosSource, /private let options: \[BrandThemePreference\] = \[\.light, \.dark\]/);
  assert.doesNotMatch(iosSource, /ForEach\(BrandThemePreference\.allCases\)/);
  assert.match(iosSource, /settings-theme-selector/);
  assert.match(iosSource, /settings-theme-\\\(option\.id\)-button/);
  assert.match(iosSource, /dynamicUIColor\(light: 0xffffff, dark: 0x0d1117\)/);
});

test("design borders use a consistent single-pixel weight", async () => {
  const iosSource = await readFile(
    new URL("../../ios/PacePushApp.swift", import.meta.url),
    "utf8",
  );
  const androidSource = await readFile(
    new URL("../../android/app/src/main/java/com/paceandpush/MainActivity.kt", import.meta.url),
    "utf8",
  );
  const globalCss = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const brandSource = await readFile(
    new URL("../../../packages/brand/src/index.ts", import.meta.url),
    "utf8",
  );
  const chartSource = await readFile(
    new URL("../src/server/charts/profile-chart.ts", import.meta.url),
    "utf8",
  );

  assert.match(iosSource, /static let borderWidth: CGFloat = 1/);
  assert.match(iosSource, /static let line = dynamicColor\(light: 0xd0d7de, dark: 0x30363d\)/);
  assert.match(iosSource, /static let cornerRadius: CGFloat = 6/);
  assert.match(androidSource, /const val CORNER_RADIUS_DP = 6/);
  assert.match(androidSource, /cornerRadius = dp\(CORNER_RADIUS_DP\)\.toFloat\(\)/);
  assert.match(brandSource, /github: 6/);
  assert.match(brandSource, /css: "6px"/);
  assert.match(brandSource, /--score: \$\{colors\.secondaryOrange\}/);
  assert.match(brandSource, /--distance: \$\{colors\.rankBlue\}/);
  assert.match(iosSource, /color: Brand\.orange[\s\S]*MetricTile\([\s\S]*title: "Commits"/);
  assert.match(iosSource, /valueAccessibilityIdentifier: "profile-score-value"/);
  assert.match(iosSource, /valueAccessibilityIdentifier: "profile-commits-value"/);
  assert.match(iosSource, /valueAccessibilityIdentifier: "profile-distance-value"/);
  assert.match(iosSource, /title: units\.title,[\s\S]*color: Brand\.blue/);
  assert.match(iosSource, /ForEach\(ProfileChartSeries\.barSeries\)/);
  assert.match(iosSource, /linePath\(for: \.score, in: geometry\.size\)/);
  assert.match(iosSource, /private func barPath\(for series: ProfileChartSeries/);
  assert.match(iosSource, /\.foregroundStyle\(series\.color\)/);
  assert.match(androidSource, /ProfileTrendChartView\(history\)/);
  assert.match(androidSource, /dailyDeltas\(points\.map \{ it\.kilometers \}\)/);
  assert.match(androidSource, /drawScoreLine\(canvas, chartWidth, chartHeight, baseline\)/);
  assert.match(androidSource, /Board\.Balanced -> LeaderboardMetric\([\s\S]*color = orange/);
  assert.match(androidSource, /Board\.Distance -> LeaderboardMetric\([\s\S]*color = blue/);
  assert.match(iosSource, /lineWidth: CGFloat = Brand\.borderWidth/);
  assert.doesNotMatch(iosSource, /stroke\(Brand\.ink/);
  assert.doesNotMatch(iosSource, /\.pickerStyle\(\.segmented\)/);
  assert.doesNotMatch(iosSource, /UISegmentedControl\.appearance/);
  assert.doesNotMatch(iosSource, /lineWidth: [23](?![0-9.])/);
  assert.match(globalCss, /\.logo-mark \{[\s\S]*border: 1px solid var\(--ink\)/);
  assert.doesNotMatch(globalCss, /border(?:-left)?: [24]px solid var/);
  assert.match(globalCss, /border-radius: var\(--corner-radius\)/);
  assert.doesNotMatch(globalCss, /^\s*border-radius:(?!\s*(?:var\(--corner-radius\)|0\b))[^;]+;/m);
  assert.doesNotMatch(globalCss, /box-shadow: inset 4px/);
  assert.match(chartSource, /stroke-width="1"/);
  assert.match(chartSource, /const cornerRadius = brandRadius\.github/);
  assert.match(chartSource, /rx="\$\{cornerRadius\}"/);
  assert.doesNotMatch(chartSource, /rx="1[78]/);
});

test("launch evidence docs cover alerts, rollback, stores, and real devices", async () => {
  const runbook = await readFile(
    new URL("../../../docs/launch/release-runbook.md", import.meta.url),
    "utf8",
  );
  const realDeviceChecklist = await readFile(
    new URL("../../../docs/launch/real-device-beta-checklist.md", import.meta.url),
    "utf8",
  );
  const appStore = await readFile(
    new URL("../../../docs/store-listing/app-store.md", import.meta.url),
    "utf8",
  );
  const googlePlay = await readFile(
    new URL("../../../docs/store-listing/google-play.md", import.meta.url),
    "utf8",
  );
  const screenshots = await readFile(
    new URL("../../../docs/store-listing/screenshots.md", import.meta.url),
    "utf8",
  );

  assert.match(runbook, /Vercel Cron failure notifications/);
  assert.match(runbook, /https:\/\/paceandpush\.com\/api\/health/);
  assert.match(runbook, /Rollback path/);
  assert.match(runbook, /Pause mobile sync/);
  assert.match(runbook, /DELETE \/api\/mobile\/devices\/:id\/revoke/);
  assert.match(runbook, /hawigxyz@proton\.me/);

  assert.match(realDeviceChecklist, /GitHub auth succeeds/);
  assert.match(realDeviceChecklist, /Health Connect permission denial/);
  assert.match(realDeviceChecklist, /Token revocation disables further mobile API access/);

  assert.match(appStore, /Privacy Labels/);
  assert.match(appStore, /daily aggregate running distance totals/);
  assert.match(appStore, /GitHub-specific login\s+rationale/);
  assert.match(googlePlay, /Health Connect Declaration/);
  assert.match(googlePlay, /Public Release Blockers/);
  assert.match(screenshots, /Zero-distance recovery hint/);
  assert.match(screenshots, /Leaderboard\/profile loaded from the real API/);
});

test("Android client is wired to real mobile APIs and Health Connect sync", async () => {
  const androidSource = await readFile(
    new URL("../../android/app/src/main/java/com/paceandpush/MainActivity.kt", import.meta.url),
    "utf8",
  );
  const androidManifest = await readFile(
    new URL("../../android/app/src/main/AndroidManifest.xml", import.meta.url),
    "utf8",
  );
  const healthConnectSource = await readFile(
    new URL(
      "../../android/app/src/main/java/com/paceandpush/HealthConnectDistanceSync.kt",
      import.meta.url,
    ),
    "utf8",
  );
  const androidReadme = await readFile(
    new URL("../../android/README.md", import.meta.url),
    "utf8",
  );
  const androidWorkflow = await readFile(
    new URL("../../../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const androidRootBuild = await readFile(
    new URL("../../android/build.gradle.kts", import.meta.url),
    "utf8",
  );
  const androidGradleProperties = await readFile(
    new URL("../../android/gradle.properties", import.meta.url),
    "utf8",
  );
  const androidBuild = await readFile(
    new URL("../../android/app/build.gradle.kts", import.meta.url),
    "utf8",
  );
  const launcherIcon = await readFile(
    new URL(
      "../../android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(androidSource, /ComponentActivity/);
  assert.match(androidSource, /createRequestPermissionResultContract/);
  assert.match(androidSource, /decryptDeviceToken/);
  assert.match(androidSource, /\/api\/mobile\/me/);
  assert.match(androidSource, /\/api\/mobile\/me\/profile/);
  assert.match(androidSource, /\/api\/leaderboard\?board=/);
  assert.match(androidSource, /\/api\/mobile\/distance-days/);
  assert.match(androidSource, /\/api\/mobile\/sync-runs/);
  assert.match(androidSource, /\/api\/mobile\/me\/github\/disconnect/);
  assert.match(androidSource, /Authorization", "Bearer \$it"/);
  assert.match(androidSource, /PREF_THEME = "theme_preference"/);
  assert.match(androidSource, /enum class AppThemePreference/);
  assert.match(androidSource, /Configuration\.UI_MODE_NIGHT_MASK/);
  assert.match(androidSource, /themeSelector\(\)/);
  assert.match(androidSource, /applyBrandSystemBars\(\)/);
  assert.match(androidSource, /optBoolean\("publicLeaderboard", false\)/);
  assert.match(
    androidSource,
    /private fun emptyMeSummary\(\): MeSummary \{[\s\S]*publicLeaderboard = false/,
  );

  assert.match(androidManifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(androidManifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
  assert.match(launcherIcon, /<adaptive-icon/);
  assert.match(launcherIcon, /@drawable\/ic_launcher_foreground/);

  assert.match(healthConnectSource, /ZoneOffset\.UTC/);
  assert.match(healthConnectSource, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(healthConnectSource, /session\.metadata\.id/);

  assert.match(androidReadme, /internal-test client/);
  assert.match(androidReadme, /Health Connect permission UX/);
  assert.match(androidReadme, /\/api\/mobile\/sync-runs/);
  assert.match(androidReadme, /Android CI build is green on `main`/);
  assert.match(androidWorkflow, /android:/);
  assert.match(androidWorkflow, /grep -rl "packages\.microsoft\.com" \/etc\/apt\/sources\.list\.d/);
  assert.match(androidWorkflow, /npx playwright install --with-deps webkit/);
  assert.match(androidWorkflow, /gradle-version: "8\.11\.1"/);
  assert.match(
    androidWorkflow,
    /gradle -p apps\/android :app:testDebugUnitTest :app:assembleDebug --no-daemon/,
  );
  assert.match(androidRootBuild, /com\.android\.application"\) version "8\.9\.2"/);
  assert.match(androidGradleProperties, /android\.useAndroidX=true/);
  assert.match(androidGradleProperties, /android\.suppressUnsupportedCompileSdk=36/);
  assert.match(androidBuild, /androidx\.health\.connect:connect-client:1\.1\.0/);
  assert.match(androidBuild, /sourceCompatibility = JavaVersion\.VERSION_17/);
  assert.match(androidBuild, /targetCompatibility = JavaVersion\.VERSION_17/);
  assert.match(androidBuild, /jvmToolchain\(17\)/);
});

test("beta feedback, share profile, and health repair paths stay visible", async () => {
  const iosSource = await readFile(
    new URL("../../ios/PacePushApp.swift", import.meta.url),
    "utf8",
  );
  const androidSource = await readFile(
    new URL("../../android/app/src/main/java/com/paceandpush/MainActivity.kt", import.meta.url),
    "utf8",
  );
  const webSettings = await readFile(
    new URL("../src/app/settings/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(iosSource, /SupportLinks/);
  assert.match(iosSource, /hawigxyz@proton\.me/);
  assert.match(iosSource, /ShareLink\(item: shareURL\)/);
  assert.match(iosSource, /shareProfileURL/);
  assert.match(iosSource, /No running distance found/);
  assert.match(iosSource, /Settings > Health > Data Access & Devices/);
  assert.match(iosSource, /beta-feedback-link/);

  assert.match(androidSource, /SUPPORT_EMAIL = "hawigxyz@proton\.me"/);
  assert.match(androidSource, /openSupportEmail/);
  assert.match(androidSource, /openPublicProfile/);
  assert.match(androidSource, /\/users\/\$\{Uri\.encode\(login\)\}/);

  assert.match(webSettings, /Beta feedback/);
  assert.match(webSettings, /mailto:hawigxyz@proton\.me/);
});

async function loadTypeScriptModule(relativePath, contextOverrides = {}) {
  const url = new URL(relativePath, import.meta.url);
  const source = await readFile(url, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };

  vm.runInNewContext(output, {
    Buffer,
    console,
    exports: module.exports,
    fetch,
    module,
    process,
    require,
    URL,
    ...contextOverrides,
  }, {
    filename: url.pathname,
  });

  return module.exports;
}

function restoreEnv(key, previousValue) {
  if (previousValue === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = previousValue;
  }
}

function snapshotEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnvSnapshot(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    restoreEnv(key, value);
  }
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
