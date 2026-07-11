import type {
  Board,
  LeaderboardRow,
  LeaderboardResponse,
  MeResponse,
  ProfileHistoryPoint,
  PublicProfileResponse,
  ScoreSummary,
  UserSearchResponse,
} from "@paceandpush/api-contracts";
import type { SessionUser } from "@/server/auth/session";
import { getAccountUser, getGitHubConnectionSummary } from "@/server/data/accounts";
import { listMobileDevices } from "@/server/data/mobile";
import {
  currentPeriod,
  periodBounds,
  recomputeScoreSnapshots,
  refreshGitHubCommitsForUser,
} from "@/server/data/scores";
import { getDb, isDatabaseConfigured } from "@/server/db/client";
import { commitDays, distanceDays, scoreSnapshots, syncRuns, users } from "@/server/db/schema";
import { isCurrentOrPreviousPeriod } from "@/lib/periods";
import { calculateStreakDays } from "@/lib/streaks";
import { currentPublicHealthDataConsentCondition } from "@/server/privacy/public-health-data-consent";
import { and, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";

type LeaderboardSnapshotRow = {
  rank: number | null;
  login: string;
  displayName: string;
  score: string;
  commits: number;
  distanceMeters: number;
  userId: string;
};

type AccountScoreUser = {
  id: string;
  login: string;
};

type ScoreSnapshotSummary = {
  score: string;
  rank: number | null;
  commits: number;
  distanceMeters: number;
};

type SearchPublicUsersOptions = {
  limit?: number;
  period?: string;
  query: string;
};

const leaderboardRowLimit = 100;

export async function getLeaderboard(
  board: Board = "balanced",
  period = currentPeriod(),
): Promise<LeaderboardResponse> {
  if (!isDatabaseConfigured()) {
    return {
      period,
      board,
      rows: [],
    };
  }

  let rows = await getLeaderboardSnapshotRows(board, period);
  if (rows.length === 0 && isCurrentOrPreviousPeriod(period)) {
    try {
      await recomputeScoreSnapshots(period);
      rows = await getLeaderboardSnapshotRows(board, period);
    } catch (error) {
      console.error("[scores] leaderboard snapshot refresh failed", error);
    }
  }

  return {
    period,
    board,
    rows: await toLeaderboardRows(rows, period),
  };
}

export async function searchPublicUsers({
  limit = 20,
  period = currentPeriod(),
  query,
}: SearchPublicUsersOptions): Promise<UserSearchResponse> {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!isDatabaseConfigured() || normalizedQuery.length < 2) {
    return {
      query: normalizedQuery,
      period,
      rows: [],
    };
  }

  const rows = await getPublicUserSearchRows(
    normalizedQuery,
    period,
    normalizeSearchLimit(limit),
  );

  return {
    query: normalizedQuery,
    period,
    rows: await toLeaderboardRows(rows, period),
  };
}

async function getLeaderboardSnapshotRows(
  board: Board,
  period: string,
): Promise<LeaderboardSnapshotRow[]> {
  return getDb()
    .select({
      rank: scoreSnapshots.rank,
      login: users.login,
      displayName: users.displayName,
      score: scoreSnapshots.balancedScore,
      commits: scoreSnapshots.commitTotal,
      distanceMeters: scoreSnapshots.distanceMetersTotal,
      userId: users.id,
    })
    .from(scoreSnapshots)
    .innerJoin(users, eq(scoreSnapshots.userId, users.id))
    .where(
      and(
        eq(scoreSnapshots.period, period),
        eq(scoreSnapshots.board, board),
        currentPublicHealthDataConsentCondition(),
      ),
    )
    .orderBy(scoreSnapshots.rank)
    .limit(leaderboardRowLimit);
}

async function getPublicUserSearchRows(
  query: string,
  period: string,
  limit: number,
): Promise<LeaderboardSnapshotRow[]> {
  const lowerQuery = query.toLowerCase();
  const escapedQuery = escapeLikePattern(lowerQuery);
  const containsPattern = `%${escapedQuery}%`;
  const prefixPattern = `${escapedQuery}%`;
  const searchDocument = sql`lower(${users.login} || ' ' || ${users.displayName} || ' ' || coalesce(${users.bio}, ''))`;

  return getDb()
    .select({
      rank: scoreSnapshots.rank,
      login: users.login,
      displayName: users.displayName,
      score: scoreSnapshots.balancedScore,
      commits: scoreSnapshots.commitTotal,
      distanceMeters: scoreSnapshots.distanceMetersTotal,
      userId: users.id,
    })
    .from(scoreSnapshots)
    .innerJoin(users, eq(scoreSnapshots.userId, users.id))
    .where(
      and(
        eq(scoreSnapshots.period, period),
        eq(scoreSnapshots.board, "balanced"),
        currentPublicHealthDataConsentCondition(),
        sql`${searchDocument} LIKE ${containsPattern} ESCAPE '!'`,
      ),
    )
    .orderBy(
      sql`
        CASE
          WHEN lower(${users.login}) = ${lowerQuery} THEN 0
          WHEN lower(${users.login}) LIKE ${prefixPattern} ESCAPE '!' THEN 1
          WHEN lower(${users.displayName}) LIKE ${prefixPattern} ESCAPE '!' THEN 2
          ELSE 3
        END
      `,
      sql`${scoreSnapshots.rank} ASC NULLS LAST`,
      users.login,
    )
    .limit(limit);
}

async function toLeaderboardRows(
  rows: LeaderboardSnapshotRow[],
  period: string,
): Promise<LeaderboardRow[]> {
  const streaksByUserId = await getStreakDaysByUserId(
    rows.map((row) => row.userId),
    period,
  );

  return rows.map((row, index) => ({
    rank: row.rank ?? index + 1,
    login: row.login,
    displayName: row.displayName,
    score: Number(row.score),
    commits: row.commits,
    kilometers: Math.round((row.distanceMeters / 1000) * 10) / 10,
    streakDays: streaksByUserId.get(row.userId) ?? 0,
  }));
}

export async function getPublicProfile(
  login: string,
  period = currentPeriod(),
): Promise<PublicProfileResponse | null> {
  if (!isDatabaseConfigured()) return null;

  const [user] = await getDb()
    .select()
    .from(users)
    .where(
      and(
        eq(sql`lower(${users.login})`, login.toLowerCase()),
        currentPublicHealthDataConsentCondition(),
      ),
    )
    .orderBy(desc(users.updatedAt))
    .limit(1);

  if (!user) return null;

  if (!(await hasScoreSnapshot(user.id, period)) && isCurrentOrPreviousPeriod(period)) {
    try {
      await recomputeScoreSnapshots(period);
    } catch (error) {
      console.error("[scores] public profile snapshot refresh failed", error);
    }
  }

  const score = await getScoreSummary(user.id, period);

  return {
    login: user.login,
    displayName: user.displayName,
    bio: user.bio,
    score,
    history: user.publicActivityHistory
      ? await getProfileHistory(user.id, period, score.score)
      : [],
    historyVisibility: user.publicActivityHistory ? "public" : "private",
  };
}

export async function getAccountProfile({
  userId,
  login,
  displayName,
  bio,
  period = currentPeriod(),
}: {
  userId: string;
  login: string;
  displayName: string;
  bio: string | null;
  period?: string;
}): Promise<PublicProfileResponse> {
  const score = await getFreshAccountScoreSummary({ id: userId, login }, period);

  return {
    login,
    displayName,
    bio,
    score,
    history: await getProfileHistory(userId, period, score.score),
    historyVisibility: "owner",
  };
}

export async function getMe(
  sessionUser: SessionUser | null,
  period = currentPeriod(),
): Promise<MeResponse> {
  if (!isDatabaseConfigured()) {
    return {
      login: sessionUser?.login ?? "guest",
      displayName: sessionUser?.displayName ?? "Guest",
      publicLeaderboard: false,
      publicActivityHistory: false,
      publicHealthDataConsentVersion: null,
      publicHealthDataConsentedAt: null,
      units: "metric",
      score: emptyScore(period),
      github: emptyGitHubConnection(),
      devices: [],
    };
  }

  const account = await getAccountUser(sessionUser);

  if (!account) {
    return {
      login: sessionUser?.login ?? "guest",
      displayName: sessionUser?.displayName ?? "Guest",
      publicLeaderboard: false,
      publicActivityHistory: false,
      publicHealthDataConsentVersion: null,
      publicHealthDataConsentedAt: null,
      units: "metric",
      score: emptyScore(period),
      github: emptyGitHubConnection(),
      devices: [],
    };
  }

  const score = await getFreshAccountScoreSummary(account, period);

  return {
    login: account.login,
    displayName: account.displayName,
    publicLeaderboard: account.publicLeaderboard,
    publicActivityHistory: account.publicActivityHistory,
    publicHealthDataConsentVersion: account.publicHealthDataConsentVersion,
    publicHealthDataConsentedAt:
      account.publicHealthDataConsentedAt?.toISOString() ?? null,
    units: account.units,
    score,
    github: await getGitHubConnectionSummary(account.id),
    devices: await listMobileDevices(account.id),
  };
}

export function parseBoard(value: string | null): Board {
  if (value === "commits" || value === "distance" || value === "balanced") {
    return value;
  }
  return "balanced";
}

function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

function normalizeSearchLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

function escapeLikePattern(value: string): string {
  return value.replace(/[!%_]/g, (character) => `!${character}`);
}

export { parsePeriod } from "@/server/data/scores";

async function getScoreSnapshot(
  userId: string,
  period: string,
): Promise<ScoreSnapshotSummary | null> {
  const [snapshot] = await getDb()
    .select({
      score: scoreSnapshots.balancedScore,
      rank: scoreSnapshots.rank,
      commits: scoreSnapshots.commitTotal,
      distanceMeters: scoreSnapshots.distanceMetersTotal,
    })
    .from(scoreSnapshots)
    .where(
      and(
        eq(scoreSnapshots.userId, userId),
        eq(scoreSnapshots.period, period),
        eq(scoreSnapshots.board, "balanced"),
      ),
    )
    .limit(1);

  return snapshot ?? null;
}

async function getScoreSummary(userId: string, period: string): Promise<ScoreSummary> {
  const snapshot = await getScoreSnapshot(userId, period);
  const [lastSync] = await getDb()
    .select({
      finishedAt: syncRuns.finishedAt,
      startedAt: syncRuns.startedAt,
    })
    .from(syncRuns)
    .where(eq(syncRuns.userId, userId))
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);

  if (!snapshot) {
    return {
      ...emptyScore(period),
      lastSyncAt:
        lastSync?.finishedAt?.toISOString() ?? lastSync?.startedAt?.toISOString() ?? null,
    };
  }

  return {
    period,
    score: Number(snapshot.score),
    rank: snapshot.rank,
    commits: snapshot.commits,
    kilometers: Math.round((snapshot.distanceMeters / 1000) * 10) / 10,
    lastSyncAt:
      lastSync?.finishedAt?.toISOString() ?? lastSync?.startedAt?.toISOString() ?? null,
  };
}

async function getFreshAccountScoreSummary(
  account: AccountScoreUser,
  period: string,
): Promise<ScoreSummary> {
  if (!(await shouldRefreshAccountScoreSnapshot(account.id, period))) {
    return getScoreSummary(account.id, period);
  }

  try {
    await refreshGitHubCommitsForUser({
      userId: account.id,
      login: account.login,
      period,
    });
    await recomputeScoreSnapshots(period);
  } catch (error) {
    console.error("[scores] authenticated score refresh failed", error);
  }

  return getScoreSummary(account.id, period);
}

async function shouldRefreshAccountScoreSnapshot(
  userId: string,
  period: string,
): Promise<boolean> {
  const snapshot = await getScoreSnapshot(userId, period);
  if (!snapshot) return true;

  return !(await hasCompleteCommitCoverage(userId, period));
}

async function hasCompleteCommitCoverage(userId: string, period: string): Promise<boolean> {
  const { start, end: periodEnd } = periodBounds(period);
  const end = commitCoverageEnd(periodEnd);
  const expectedDays = expectedCommitCoverageDays(start, end);
  if (expectedDays === 0) return true;

  const [coverage] = await getDb()
    .select({ days: sql<number>`count(*)::int` })
    .from(commitDays)
    .where(
      and(
        eq(commitDays.userId, userId),
        gte(commitDays.day, start),
        lte(commitDays.day, end),
      ),
    );

  return Number(coverage?.days ?? 0) >= expectedDays;
}

function commitCoverageEnd(periodEnd: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return periodEnd > today ? today : periodEnd;
}

function expectedCommitCoverageDays(start: string, end: string): number {
  if (start > end) return 0;
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  return Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

async function hasScoreSnapshot(userId: string, period: string): Promise<boolean> {
  const [snapshot] = await getDb()
    .select({ id: scoreSnapshots.id })
    .from(scoreSnapshots)
    .where(
      and(
        eq(scoreSnapshots.userId, userId),
        eq(scoreSnapshots.period, period),
        eq(scoreSnapshots.board, "balanced"),
      ),
    )
    .limit(1);

  return Boolean(snapshot);
}

async function getProfileHistory(
  userId: string,
  period: string,
  latestScore: number,
): Promise<ProfileHistoryPoint[]> {
  const { start, end } = periodBounds(period);
  const [commits, distances] = await Promise.all([
    getDb()
      .select({
        day: commitDays.day,
        count: commitDays.commitCount,
      })
      .from(commitDays)
      .where(
        and(
          eq(commitDays.userId, userId),
          gte(commitDays.day, start),
          lte(commitDays.day, end),
        ),
      ),
    getDb()
      .select({
        day: distanceDays.day,
        meters: distanceDays.meters,
      })
      .from(distanceDays)
      .where(
        and(
          eq(distanceDays.userId, userId),
          gte(distanceDays.day, start),
          lte(distanceDays.day, end),
          eq(distanceDays.flagged, false),
        ),
      ),
  ]);

  const commitByDay = new Map(commits.map((row) => [row.day, row.count]));
  const metersByDay = new Map(distances.map((row) => [row.day, row.meters]));
  const days = [...new Set([...commitByDay.keys(), ...metersByDay.keys()])].sort();
  const totalCommits = [...commitByDay.values()].reduce((sum, value) => sum + value, 0);
  const totalMeters = [...metersByDay.values()].reduce((sum, value) => sum + value, 0);
  let runningCommits = 0;
  let runningMeters = 0;

  return days.map((day) => {
    runningCommits += commitByDay.get(day) ?? 0;
    runningMeters += metersByDay.get(day) ?? 0;

    const commitRatio = totalCommits > 0 ? runningCommits / totalCommits : 0;
    const distanceRatio = totalMeters > 0 ? runningMeters / totalMeters : 0;

    return {
      date: day,
      commits: runningCommits,
      kilometers: Math.round((runningMeters / 1000) * 10) / 10,
      score: Math.round(latestScore * Math.sqrt(commitRatio * distanceRatio) * 10) / 10,
    };
  });
}

async function getStreakDaysByUserId(
  userIds: string[],
  period: string,
): Promise<Map<string, number>> {
  const uniqueUserIds = [...new Set(userIds)];
  const streaksByUserId = new Map(uniqueUserIds.map((userId) => [userId, 0]));
  if (uniqueUserIds.length === 0) return streaksByUserId;

  const { start, end } = periodBounds(period);
  const [commits, distances] = await Promise.all([
    getDb()
      .select({ day: commitDays.day, userId: commitDays.userId })
      .from(commitDays)
      .where(
        and(
          inArray(commitDays.userId, uniqueUserIds),
          gte(commitDays.day, start),
          lte(commitDays.day, end),
          gt(commitDays.commitCount, 0),
        ),
      ),
    getDb()
      .select({ day: distanceDays.day, userId: distanceDays.userId })
      .from(distanceDays)
      .where(
        and(
          inArray(distanceDays.userId, uniqueUserIds),
          gte(distanceDays.day, start),
          lte(distanceDays.day, end),
          eq(distanceDays.flagged, false),
        ),
      ),
  ]);

  const activeDaysByUserId = new Map<string, Set<string>>();

  for (const row of [...commits, ...distances]) {
    let activeDays = activeDaysByUserId.get(row.userId);
    if (!activeDays) {
      activeDays = new Set();
      activeDaysByUserId.set(row.userId, activeDays);
    }
    activeDays.add(row.day);
  }

  for (const [userId, activeDays] of activeDaysByUserId) {
    streaksByUserId.set(userId, calculateStreakDays(activeDays));
  }

  return streaksByUserId;
}

function emptyScore(period: string): ScoreSummary {
  return {
    period,
    score: 0,
    rank: null,
    commits: 0,
    kilometers: 0,
    lastSyncAt: null,
  };
}

function emptyGitHubConnection() {
  return {
    connected: false,
    needsReconnect: false,
    updatedAt: null,
  };
}
