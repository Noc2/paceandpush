import {
  getGitHubAccessToken,
  listGitHubAccountsForScoreRefresh,
} from "@/server/data/accounts";
import {
  drainDirtyScorePeriods,
  refreshDirtyScorePeriodsForUser,
  refreshUserPeriodScores,
  type DirtyScorePeriodDrainResult,
  type PeriodScoreRefreshResult,
} from "@/server/data/incremental-scores";
import { getDb } from "@/server/db/client";
import { commitDays, periodScores } from "@/server/db/schema";
import { fetchGitHubContributionDays } from "@/server/github/contributions";
import {
  currentPeriod,
  periodBounds,
  periodForKind,
} from "@/lib/periods";
import { and, eq, gte, lte, notInArray, sql } from "drizzle-orm";

export {
  currentPeriod,
  isSupportedPeriod,
  parsePeriod,
  periodBounds,
} from "@/lib/periods";
export {
  drainDirtyScorePeriods,
  refreshDirtyScorePeriodsForUser,
  refreshUserPeriodScores,
};
export type {
  DirtyScorePeriodDrainResult,
  PeriodScoreRefreshResult,
};

export type GitHubCommitRefreshResult = {
  changedDays: string[];
  updatedDays: number;
};

export type GitHubScoreRefreshResult = {
  checked: number;
  errors: Array<{ login: string; message: string }>;
  scoreRefreshes: PeriodScoreRefreshResult[];
  updatedDays: number;
};

export async function refreshGitHubCommits(
  period = currentPeriod(),
): Promise<GitHubScoreRefreshResult> {
  const accounts = await listGitHubAccountsForScoreRefresh();
  let updatedDays = 0;
  const errors: GitHubScoreRefreshResult["errors"] = [];
  const scoreRefreshes: PeriodScoreRefreshResult[] = [];

  for (const account of accounts) {
    try {
      if (!account.accessToken) {
        throw new Error("Reconnect GitHub to allow commit refresh.");
      }

      const result = await refreshGitHubCommitsForUser({
        accessToken: account.accessToken,
        userId: account.userId,
        login: account.login,
        period,
      });
      updatedDays += result.updatedDays;
      scoreRefreshes.push(
        await refreshDirtyScorePeriodsForUser(
          account.userId,
          scorePeriodsRequiredForRefresh(period),
        ),
      );
    } catch (error) {
      errors.push({
        login: account.login,
        message: error instanceof Error ? error.message : "GitHub refresh failed.",
      });
    }
  }

  return {
    checked: accounts.length,
    errors,
    scoreRefreshes,
    updatedDays,
  };
}

export async function refreshGitHubCommitsForUser({
  accessToken,
  userId,
  login,
  period = currentPeriod(),
}: {
  accessToken?: string;
  userId: string;
  login: string;
  period?: string;
}): Promise<GitHubCommitRefreshResult> {
  const { start, end: periodEnd } = periodBounds(period);
  const end = contributionRefreshEnd(start, periodEnd);
  if (!end) return { changedDays: [], updatedDays: 0 };

  const token = accessToken ?? await getGitHubAccessToken(userId);
  if (!token) {
    throw new Error("Reconnect GitHub to allow commit refresh.");
  }

  const dayCounts = await fetchGitHubContributionDays({
    accessToken: token,
    end,
    login,
    start,
  });
  const changedDays: string[] = [];

  if (dayCounts.length > 0) {
    const changedRows = await getDb()
      .insert(commitDays)
      .values(
        dayCounts.map((day) => ({
          userId,
          day: day.day,
          commitCount: day.totalCount,
          sourceMetadata: {
            source: "github_graphql_contributions_collection",
            publicCommitCount: day.publicCommits,
            restrictedContributionCount: day.restrictedContributions,
            fields: ["totalCommitContributions", "restrictedContributionsCount"],
            note:
              "restrictedContributionsCount is GitHub's private/restricted contribution aggregate visible to this token.",
          },
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [commitDays.userId, commitDays.day],
        set: {
          commitCount: sql`excluded.commit_count`,
          sourceMetadata: sql`excluded.source_metadata`,
          updatedAt: new Date(),
        },
        setWhere: sql`
          ${commitDays.commitCount} IS DISTINCT FROM excluded.commit_count
          OR ${commitDays.sourceMetadata} IS DISTINCT FROM excluded.source_metadata
        `,
      })
      .returning({ day: commitDays.day });
    changedDays.push(...changedRows.map((row) => row.day));
  }

  const staleRows = dayCounts.length > 0
    ? await getDb()
      .delete(commitDays)
      .where(
        and(
          eq(commitDays.userId, userId),
          gte(commitDays.day, start),
          lte(commitDays.day, end),
          notInArray(commitDays.day, dayCounts.map((day) => day.day)),
        ),
      )
      .returning({ day: commitDays.day })
    : await getDb()
      .delete(commitDays)
      .where(
        and(
          eq(commitDays.userId, userId),
          gte(commitDays.day, start),
          lte(commitDays.day, end),
        ),
      )
      .returning({ day: commitDays.day });
  changedDays.push(...staleRows.map((row) => row.day));
  const uniqueChangedDays = [...new Set(changedDays)].sort();

  return {
    changedDays: uniqueChangedDays,
    updatedDays: uniqueChangedDays.length,
  };
}

export async function getScorePeriodsForUser(
  userId: string,
  extraPeriods: Iterable<string> = [],
): Promise<string[]> {
  const rows = await getDb()
    .select({ period: periodScores.period })
    .from(periodScores)
    .where(eq(periodScores.userId, userId));

  return uniqueSortedPeriods([
    ...extraPeriods,
    ...rows.map((row) => row.period),
  ]);
}

export function scorePeriodsRequiredForRefresh(
  period: string,
  date = new Date(),
): string[] {
  const periods = new Set([period]);
  const today = date.toISOString().slice(0, 10);
  const { start, end } = periodBounds(period);

  if (today >= start && today <= end) {
    periods.add(currentPeriod(date));
    periods.add(periodForKind("week", date));
    periods.add(periodForKind("year", date));
  }

  return [...periods].sort();
}

function contributionRefreshEnd(start: string, end: string): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const cappedEnd = end > today ? today : end;
  return start <= cappedEnd ? cappedEnd : null;
}

function uniqueSortedPeriods(periods: Iterable<string>): string[] {
  return [...new Set(periods)].sort();
}
