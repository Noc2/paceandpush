import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

const contributions = await loadTypeScriptModule("../src/server/github/contributions.ts");
const mobileTokens = await loadTypeScriptModule("../src/server/mobile/tokens.ts");
const oauth = await loadTypeScriptModule("../src/server/github/oauth.ts");
const periods = await loadTypeScriptModule("../src/lib/periods.ts");
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

test("GitHub OAuth authorize URL includes the explicit redirect URI", () => {
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
        mobileTokens.createPairingCode({
          githubId: "123",
          login: "octocat",
          displayName: "Octo Cat",
          avatarUrl: null,
        }),
      /MOBILE_TOKEN_SECRET is required in production/,
    );

    process.env.MOBILE_TOKEN_SECRET = process.env.SESSION_SECRET;
    assert.throws(
      () =>
        mobileTokens.createPairingCode({
          githubId: "123",
          login: "octocat",
          displayName: "Octo Cat",
          avatarUrl: null,
        }),
      /MOBILE_TOKEN_SECRET must be distinct from SESSION_SECRET in production/,
    );
  } finally {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("MOBILE_TOKEN_SECRET", previousMobileSecret);
    restoreEnv("SESSION_SECRET", previousSessionSecret);
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

test("leaderboard streaks are loaded in batched queries", async () => {
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
  assert.match(source, /inArray\(distanceDays\.userId, uniqueUserIds\)/);
});

test("GitHub commit refresh upserts before deleting stale days", async () => {
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
  assert.match(refreshBlock, /notInArray\(commitDays\.day/);
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

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
