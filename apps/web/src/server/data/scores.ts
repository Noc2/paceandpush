import { scoreActivity, type Board } from "@paceandpush/api-contracts";
import {
  getGitHubAccessToken,
  listGitHubAccountsForScoreRefresh,
} from "@/server/data/accounts";
import { getDb } from "@/server/db/client";
import { commitDays, distanceDays, scoreSnapshots, users } from "@/server/db/schema";
import { fetchGitHubContributionDays } from "@/server/github/contributions";
import { currentPeriod, periodBounds, periodDayCount } from "@/lib/periods";
import { hasCurrentPublicHealthDataConsent } from "@/server/privacy/public-health-data-consent";
import { and, eq, gte, lte, notInArray, sql } from "drizzle-orm";

interface ScoreTotals {
  userId: string;
  commits: number;
  kilometers: number;
  publicLeaderboard: boolean;
}

const recomputeInFlight = new Map<string, Promise<{
  period: string;
  users: number;
  snapshots: number;
}>>();

export { currentPeriod, isSupportedPeriod, parsePeriod, periodBounds } from "@/lib/periods";

export async function refreshGitHubCommits(period = currentPeriod()): Promise<{
  checked: number;
  updatedDays: number;
  errors: Array<{ login: string; message: string }>;
}> {
  const accounts = await listGitHubAccountsForScoreRefresh();
  let updatedDays = 0;
  const errors: Array<{ login: string; message: string }> = [];

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
    } catch (error) {
      errors.push({
        login: account.login,
        message: error instanceof Error ? error.message : "GitHub refresh failed.",
      });
    }
  }

  return {
    checked: accounts.length,
    updatedDays,
    errors,
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
}): Promise<{ updatedDays: number }> {
  const { start, end: periodEnd } = periodBounds(period);
  const end = contributionRefreshEnd(start, periodEnd);
  if (!end) return { updatedDays: 0 };

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

  if (dayCounts.length > 0) {
    await getDb()
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
      });
  }

  await getDb()
    .delete(commitDays)
    .where(
      and(
        eq(commitDays.userId, userId),
        gte(commitDays.day, start),
        lte(commitDays.day, end),
        notInArray(commitDays.day, dayCounts.map((day) => day.day)),
      ),
    );

  return { updatedDays: dayCounts.length };
}

function contributionRefreshEnd(start: string, end: string): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const cappedEnd = end > today ? today : end;
  return start <= cappedEnd ? cappedEnd : null;
}

export async function recomputeScoreSnapshots(period = currentPeriod()): Promise<{
  period: string;
  users: number;
  snapshots: number;
}> {
  const existing = recomputeInFlight.get(period);
  if (existing) return existing;

  const recompute = recomputeScoreSnapshotsUnlocked(period).finally(() => {
    recomputeInFlight.delete(period);
  });
  recomputeInFlight.set(period, recompute);
  return recompute;
}

async function recomputeScoreSnapshotsUnlocked(period: string): Promise<{
  period: string;
  users: number;
  snapshots: number;
}> {
  const totals = await getScoreTotals(period);
  const periodDays = periodDayCount(period);
  const scoredRows = totals.map((row) => ({
    ...row,
    ...scoreActivity({
      commits: row.commits,
      kilometers: row.kilometers,
      periodDays,
    }),
  }));
  const boards: Board[] = ["balanced", "commits", "distance"];
  let snapshots = 0;

  for (const board of boards) {
    const rankedPublicRows = scoredRows
      .filter((row) => row.publicLeaderboard)
      .sort((left, right) => compareBoardRows(board, left, right));
    const rankByUserId = new Map(
      rankedPublicRows.map((row, index) => [row.userId, index + 1]),
    );

    await Promise.all(
      scoredRows.map(async (row) => {
        await getDb()
          .insert(scoreSnapshots)
          .values({
            userId: row.userId,
            period,
            board,
            commitTotal: row.commits,
            distanceMetersTotal: Math.round(row.kilometers * 1000),
            commitComponent: row.commitComponent.toFixed(6),
            distanceComponent: row.distanceComponent.toFixed(6),
            score: row.score.toFixed(6),
            rank: rankByUserId.get(row.userId) ?? null,
          })
          .onConflictDoUpdate({
            target: [scoreSnapshots.userId, scoreSnapshots.period, scoreSnapshots.board],
            set: {
              commitTotal: row.commits,
              distanceMetersTotal: Math.round(row.kilometers * 1000),
              commitComponent: row.commitComponent.toFixed(6),
              distanceComponent: row.distanceComponent.toFixed(6),
              score: row.score.toFixed(6),
              rank: rankByUserId.get(row.userId) ?? null,
              createdAt: new Date(),
            },
          });
        snapshots += 1;
      }),
    );
  }

  return {
    period,
    users: scoredRows.length,
    snapshots,
  };
}

export async function getScoreSnapshotPeriodsForUser(
  userId: string,
  extraPeriods: string[] = [],
): Promise<string[]> {
  const rows = await getDb()
    .select({ period: scoreSnapshots.period })
    .from(scoreSnapshots)
    .where(eq(scoreSnapshots.userId, userId));

  return uniqueSortedPeriods([...extraPeriods, ...rows.map((row) => row.period)]);
}

export async function recomputeScoreSnapshotPeriods(periods: Iterable<string>): Promise<void> {
  for (const period of uniqueSortedPeriods(periods)) {
    await recomputeScoreSnapshots(period);
  }
}

export async function refreshScoresAfterLeaderboardVisibilityChange({
  userId,
  login,
  publicLeaderboard,
  period = currentPeriod(),
}: {
  userId: string;
  login: string;
  publicLeaderboard: boolean;
  period?: string;
}): Promise<void> {
  const affectedPeriods = await getScoreSnapshotPeriodsForUser(userId, [period]);

  if (publicLeaderboard) {
    try {
      await refreshGitHubCommitsForUser({ userId, login, period });
    } catch (error) {
      console.error("[scores] GitHub commit refresh after leaderboard opt-in failed", error);
    }
  }

  await recomputeScoreSnapshotPeriods(affectedPeriods);
}

async function getScoreTotals(period: string): Promise<ScoreTotals[]> {
  const db = getDb();
  const { start, end } = periodBounds(period);
  const [userRows, commitRows, distanceRows] = await Promise.all([
    db
      .select({
        id: users.id,
        publicLeaderboard: users.publicLeaderboard,
        publicHealthDataConsentVersion: users.publicHealthDataConsentVersion,
        publicHealthDataConsentedAt: users.publicHealthDataConsentedAt,
        publicHealthDataConsentRevokedAt: users.publicHealthDataConsentRevokedAt,
      })
      .from(users),
    db
      .select({
        userId: commitDays.userId,
        commitCount: commitDays.commitCount,
      })
      .from(commitDays)
      .where(and(gte(commitDays.day, start), lte(commitDays.day, end))),
    db
      .select({
        userId: distanceDays.userId,
        meters: distanceDays.meters,
      })
      .from(distanceDays)
      .where(
        and(
          gte(distanceDays.day, start),
          lte(distanceDays.day, end),
          eq(distanceDays.flagged, false),
        ),
      ),
  ]);

  const commitsByUser = new Map<string, number>();
  const metersByUser = new Map<string, number>();

  for (const row of commitRows) {
    commitsByUser.set(
      row.userId,
      (commitsByUser.get(row.userId) ?? 0) + row.commitCount,
    );
  }

  for (const row of distanceRows) {
    metersByUser.set(row.userId, (metersByUser.get(row.userId) ?? 0) + row.meters);
  }

  return userRows.map((user) => ({
    userId: user.id,
    publicLeaderboard: hasCurrentPublicHealthDataConsent(user),
    commits: commitsByUser.get(user.id) ?? 0,
    kilometers: (metersByUser.get(user.id) ?? 0) / 1000,
  }));
}

function compareBoardRows(
  board: Board,
  left: ScoreTotals & { score: number },
  right: ScoreTotals & { score: number },
): number {
  const primaryDifference = board === "commits"
    ? right.commits - left.commits
    : board === "distance"
      ? right.kilometers - left.kilometers
      : right.score - left.score;
  if (primaryDifference !== 0) return primaryDifference;

  const commitDifference = right.commits - left.commits;
  if (commitDifference !== 0) return commitDifference;

  const distanceDifference = right.kilometers - left.kilometers;
  if (distanceDifference !== 0) return distanceDifference;

  return left.userId.localeCompare(right.userId);
}

function uniqueSortedPeriods(periods: Iterable<string>): string[] {
  return [...new Set(periods)].sort();
}
