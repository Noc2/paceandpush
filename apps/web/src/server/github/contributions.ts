const githubGraphqlUrl = "https://api.github.com/graphql";
const githubContributionBatchSize = 14;
const githubContributionMaxAttempts = 3;
const githubContributionRetryDelayMs = 250;
const loginPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

export interface GitHubContributionDay {
  day: string;
  publicCommits: number;
  restrictedContributions: number;
  totalCount: number;
}

export interface GitHubContributionDayWindow {
  day: string;
  from: string;
  to: string;
}

interface GitHubContributionPayload {
  data?: {
    user: Record<
      string,
      {
        totalCommitContributions?: number;
        restrictedContributionsCount?: number;
      }
    > | null;
  };
  errors?: Array<{ message: string }>;
}

type FetchLike = typeof fetch;

export function githubContributionDayWindows(
  start: string,
  end: string,
): GitHubContributionDayWindow[] {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  if (startDate > endDate) return [];

  const windows: GitHubContributionDayWindow[] = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const day = cursor.toISOString().slice(0, 10);
    windows.push({
      day,
      from: `${day}T00:00:00Z`,
      to: `${day}T23:59:59Z`,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return windows;
}

export async function fetchGitHubContributionDays({
  accessToken,
  end,
  fetchImpl = fetch,
  login,
  retryDelayMs = githubContributionRetryDelayMs,
  start,
}: {
  accessToken: string;
  end: string;
  fetchImpl?: FetchLike;
  login: string;
  retryDelayMs?: number;
  start: string;
}): Promise<GitHubContributionDay[]> {
  const windows = githubContributionDayWindows(start, end);
  if (windows.length === 0) return [];

  const batches: GitHubContributionDayWindow[][] = [];
  for (let index = 0; index < windows.length; index += githubContributionBatchSize) {
    batches.push(windows.slice(index, index + githubContributionBatchSize));
  }

  const results = await Promise.all(
    batches.map((batch) => fetchContributionBatch({
      accessToken,
      batch,
      fetchImpl,
      login,
      retryDelayMs,
    })),
  );

  return results.flat();
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("GitHub contribution windows require YYYY-MM-DD dates.");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("GitHub contribution windows require valid calendar dates.");
  }

  return date;
}

async function fetchContributionBatch({
  accessToken,
  batch,
  fetchImpl,
  login,
  retryDelayMs,
}: {
  accessToken: string;
  batch: GitHubContributionDayWindow[];
  fetchImpl: FetchLike;
  login: string;
  retryDelayMs: number;
}): Promise<GitHubContributionDay[]> {
  for (let attempt = 1; attempt <= githubContributionMaxAttempts; attempt += 1) {
    try {
      return await fetchContributionBatchOnce({
        accessToken,
        batch,
        fetchImpl,
        login,
      });
    } catch (error) {
      if (attempt >= githubContributionMaxAttempts || !isRetryableGitHubError(error)) {
        throw error;
      }
      await delay(retryDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error("GitHub contribution fetch failed.");
}

async function fetchContributionBatchOnce({
  accessToken,
  batch,
  fetchImpl,
  login,
}: {
  accessToken: string;
  batch: GitHubContributionDayWindow[];
  fetchImpl: FetchLike;
  login: string;
}): Promise<GitHubContributionDay[]> {
  const normalizedLogin = normalizeGitHubLogin(login);
  const query = `query($login: String!) {
    user(login: $login) {
      ${batch.map((window, index) => `d${index}: contributionsCollection(from: "${window.from}", to: "${window.to}") {
        totalCommitContributions
        restrictedContributionsCount
      }`).join("\n")}
    }
  }`;

  const response = await fetchImpl(githubGraphqlUrl, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "user-agent": "paceandpush",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      query,
      variables: {
        login: normalizedLogin,
      },
    }),
  });

  if (response.status === 401) {
    throw new Error("GitHub token is missing or invalid.");
  }

  if (!response.ok) {
    throw new GitHubGraphqlHttpError(response.status);
  }

  const payload = (await response.json()) as GitHubContributionPayload;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  if (!payload.data?.user) {
    throw new Error(`GitHub user "${normalizedLogin}" was not found.`);
  }

  return batch.map((window, index) => {
    const counts = payload.data?.user?.[`d${index}`];
    const publicCommits = normalizeCount(counts?.totalCommitContributions);
    const restrictedContributions = normalizeCount(counts?.restrictedContributionsCount);

    return {
      day: window.day,
      publicCommits,
      restrictedContributions,
      totalCount: publicCommits + restrictedContributions,
    };
  });
}

class GitHubGraphqlHttpError extends Error {
  constructor(readonly status: number) {
    super(`GitHub GraphQL returned ${status}.`);
  }
}

function isRetryableGitHubError(error: unknown): boolean {
  return (
    error instanceof GitHubGraphqlHttpError &&
    (error.status === 408 || error.status === 429 || error.status >= 500)
  );
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeGitHubLogin(login: string): string {
  const normalized = login.trim();
  if (!loginPattern.test(normalized)) {
    throw new Error(`"${login}" is not a valid GitHub login.`);
  }
  return normalized;
}

function normalizeCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}
