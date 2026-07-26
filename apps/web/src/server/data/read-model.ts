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
import { scoreActivity } from "@paceandpush/api-contracts";
import type { SessionUser } from "@/server/auth/session";
import { getAccountUser, getGitHubConnectionSummary } from "@/server/data/accounts";
import { listMobileDevices } from "@/server/data/mobile";
import { getDb, isDatabaseConfigured } from "@/server/db/client";
import {
  commitDays,
  distanceDays,
  periodScores,
  syncRuns,
  users,
} from "@/server/db/schema";
import {
  currentPeriod,
  periodBounds,
  periodDayCount,
} from "@/lib/periods";
import { currentPublicHealthDataConsentCondition } from "@/server/privacy/public-health-data-consent";
import { toPublicScoreSummary } from "@/server/privacy/public-profile";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

type PublicPeriodScoreRow = {
  bio: string | null;
  commits: number;
  displayName: string;
  distanceMeters: number;
  login: string;
  publicActivityHistory: boolean;
  score: string;
  streakDays: number;
  userId: string;
};

type PeriodScoreSummary = {
  commits: number;
  distanceMeters: number;
  score: string;
  streakDays: number;
};

type SearchPublicUsersOptions = {
  limit?: number;
  period?: string;
  query: string;
};

const leaderboardRowLimit = 100;

export interface PublicPeriodProjectionSource {
  boards: Record<Board, LeaderboardRow[]>;
  profiles: PublicProfileResponse[];
  searchRows: Array<{
    row: LeaderboardRow;
    searchText: string;
  }>;
}

export async function buildPublicPeriodProjectionSource(
  period: string,
): Promise<PublicPeriodProjectionSource> {
  if (!isDatabaseConfigured()) {
    return {
      boards: { balanced: [], commits: [], distance: [] },
      profiles: [],
      searchRows: [],
    };
  }

  const rows = await getPublicPeriodScoreRows(period);
  const balancedRows = rankPublicRows("balanced", rows);
  const balancedLeaderboardRows = toLeaderboardRows(balancedRows);
  const rankByUserId = new Map(
    balancedRows.map((row, index) => [row.userId, index + 1]),
  );
  const sourceByLogin = new Map(
    rows.map((row) => [row.login.toLowerCase(), row]),
  );
  const historiesByUserId = await getProfileHistories(
    rows
      .filter((row) => row.publicActivityHistory)
      .map((row) => row.userId),
    period,
  );
  const profiles = rows.map(
    (row): PublicProfileResponse => ({
      login: row.login,
      displayName: row.displayName,
      bio: row.bio,
      score: toPublicScoreSummary(
        toScoreSummary(row, period, rankByUserId.get(row.userId) ?? null),
      ),
      streakDays: row.streakDays,
      history: row.publicActivityHistory
        ? historiesByUserId.get(row.userId) ?? []
        : [],
      historyVisibility: row.publicActivityHistory ? "public" : "private",
    }),
  );

  return {
    boards: {
      balanced: balancedLeaderboardRows,
      commits: toLeaderboardRows(rankPublicRows("commits", rows)),
      distance: toLeaderboardRows(rankPublicRows("distance", rows)),
    },
    profiles,
    searchRows: balancedLeaderboardRows.map((row) => {
      const source = sourceByLogin.get(row.login.toLowerCase());
      return {
        row,
        searchText: [
          row.login,
          row.displayName,
          source?.bio ?? "",
        ].join(" ").toLowerCase(),
      };
    }),
  };
}

export async function getPublicProjectionPeriods(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await getDb()
    .selectDistinct({ period: periodScores.period })
    .from(periodScores)
    .orderBy(periodScores.period);
  return rows.map((row) => row.period);
}

export async function getLeaderboard(
  board: Board = "balanced",
  period = currentPeriod(),
): Promise<LeaderboardResponse> {
  if (!isDatabaseConfigured()) {
    return { period, board, rows: [] };
  }

  const rows = rankPublicRows(board, await getPublicPeriodScoreRows(period))
    .slice(0, leaderboardRowLimit);

  return {
    period,
    board,
    rows: toLeaderboardRows(rows),
  };
}

export async function searchPublicUsers({
  limit = 20,
  period = currentPeriod(),
  query,
}: SearchPublicUsersOptions): Promise<UserSearchResponse> {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!isDatabaseConfigured() || normalizedQuery.length < 2) {
    return { query: normalizedQuery, period, rows: [] };
  }

  const lowerQuery = normalizedQuery.toLowerCase();
  const rankedRows = rankPublicRows(
    "balanced",
    await getPublicPeriodScoreRows(period),
  );
  const rows = rankedRows
    .filter((row) =>
      [row.login, row.displayName, row.bio ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(lowerQuery),
    )
    .sort(searchRowComparator(lowerQuery))
    .slice(0, normalizeSearchLimit(limit));

  return {
    query: normalizedQuery,
    period,
    rows: toLeaderboardRows(rows),
  };
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

  const storedScore = await getPeriodScore(user.id, period);
  const score = toScoreSummary(storedScore, period, null);

  return {
    login: user.login,
    displayName: user.displayName,
    bio: user.bio,
    score: toPublicScoreSummary(score),
    streakDays: storedScore?.streakDays ?? 0,
    history: user.publicActivityHistory
      ? await getProfileHistory(user.id, period)
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
  const storedScore = await getPeriodScore(userId, period);
  const rank = await getBalancedRank(userId, period);

  return {
    login,
    displayName,
    bio,
    score: toPublicScoreSummary(toScoreSummary(storedScore, period, rank)),
    streakDays: storedScore?.streakDays ?? 0,
    history: await getProfileHistory(userId, period),
    historyVisibility: "owner",
  };
}

export async function getMe(
  sessionUser: SessionUser | null,
  period = currentPeriod(),
): Promise<MeResponse> {
  if (!isDatabaseConfigured()) {
    return emptyMe(sessionUser, period);
  }

  const account = await getAccountUser(sessionUser);
  if (!account) {
    return emptyMe(sessionUser, period);
  }

  const storedScore = await getPeriodScore(account.id, period);
  const [rank, lastSync] = await Promise.all([
    getBalancedRank(account.id, period),
    getLastSyncAt(account.id),
  ]);

  return {
    login: account.login,
    displayName: account.displayName,
    publicLeaderboard: account.publicLeaderboard,
    publicActivityHistory: account.publicActivityHistory,
    publicHealthDataConsentVersion: account.publicHealthDataConsentVersion,
    publicHealthDataConsentedAt:
      account.publicHealthDataConsentedAt?.toISOString() ?? null,
    streakDays: storedScore?.streakDays ?? 0,
    units: account.units,
    score: {
      ...toScoreSummary(storedScore, period, rank),
      lastSyncAt: lastSync,
    },
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

export { parsePeriod } from "@/lib/periods";

async function getPublicPeriodScoreRows(
  period: string,
): Promise<PublicPeriodScoreRow[]> {
  return getDb()
    .select({
      bio: users.bio,
      commits: periodScores.commitTotal,
      displayName: users.displayName,
      distanceMeters: periodScores.distanceMetersTotal,
      login: users.login,
      publicActivityHistory: users.publicActivityHistory,
      score: periodScores.score,
      streakDays: periodScores.streakDays,
      userId: users.id,
    })
    .from(periodScores)
    .innerJoin(users, eq(periodScores.userId, users.id))
    .where(
      and(
        eq(periodScores.period, period),
        currentPublicHealthDataConsentCondition(),
      ),
    );
}

async function getPeriodScore(
  userId: string,
  period: string,
): Promise<PeriodScoreSummary | null> {
  const [score] = await getDb()
    .select({
      commits: periodScores.commitTotal,
      distanceMeters: periodScores.distanceMetersTotal,
      score: periodScores.score,
      streakDays: periodScores.streakDays,
    })
    .from(periodScores)
    .where(
      and(
        eq(periodScores.userId, userId),
        eq(periodScores.period, period),
      ),
    )
    .limit(1);

  return score ?? null;
}

async function getBalancedRank(
  userId: string,
  period: string,
): Promise<number | null> {
  const [target] = await getDb()
    .select({
      commits: periodScores.commitTotal,
      distanceMeters: periodScores.distanceMetersTotal,
      score: periodScores.score,
    })
    .from(periodScores)
    .innerJoin(users, eq(periodScores.userId, users.id))
    .where(
      and(
        eq(periodScores.userId, userId),
        eq(periodScores.period, period),
        currentPublicHealthDataConsentCondition(),
      ),
    )
    .limit(1);

  if (!target) return null;

  const [result] = await getDb()
    .select({ ahead: sql<number>`count(*)::int` })
    .from(periodScores)
    .innerJoin(users, eq(periodScores.userId, users.id))
    .where(
      and(
        eq(periodScores.period, period),
        currentPublicHealthDataConsentCondition(),
        or(
          gt(periodScores.score, target.score),
          and(
            eq(periodScores.score, target.score),
            gt(periodScores.commitTotal, target.commits),
          ),
          and(
            eq(periodScores.score, target.score),
            eq(periodScores.commitTotal, target.commits),
            gt(periodScores.distanceMetersTotal, target.distanceMeters),
          ),
          and(
            eq(periodScores.score, target.score),
            eq(periodScores.commitTotal, target.commits),
            eq(periodScores.distanceMetersTotal, target.distanceMeters),
            lt(periodScores.userId, userId),
          ),
        ),
      ),
    );

  return (result?.ahead ?? 0) + 1;
}

function rankPublicRows(
  board: Board,
  rows: PublicPeriodScoreRow[],
): PublicPeriodScoreRow[] {
  return [...rows].sort((left, right) => {
    const leftScore = Number(left.score);
    const rightScore = Number(right.score);
    const primaryDifference = board === "commits"
      ? right.commits - left.commits
      : board === "distance"
        ? right.distanceMeters - left.distanceMeters
        : rightScore - leftScore;
    if (primaryDifference !== 0) return primaryDifference;

    const commitDifference = right.commits - left.commits;
    if (commitDifference !== 0) return commitDifference;

    const distanceDifference = right.distanceMeters - left.distanceMeters;
    if (distanceDifference !== 0) return distanceDifference;

    return left.userId.localeCompare(right.userId);
  });
}

function toLeaderboardRows(rows: PublicPeriodScoreRow[]): LeaderboardRow[] {
  return rows.map((row, index) => ({
    rank: index + 1,
    login: row.login,
    displayName: row.displayName,
    score: Number(row.score),
    commits: row.commits,
    kilometers: Math.round((row.distanceMeters / 1000) * 10) / 10,
    streakDays: row.streakDays,
  }));
}

function searchRowComparator(query: string) {
  return (left: PublicPeriodScoreRow, right: PublicPeriodScoreRow): number => {
    const leftLogin = left.login.toLowerCase();
    const rightLogin = right.login.toLowerCase();
    const bucket = (row: PublicPeriodScoreRow) => {
      const login = row.login.toLowerCase();
      const name = row.displayName.toLowerCase();
      return login === query
        ? 0
        : login.startsWith(query)
          ? 1
          : name.startsWith(query)
            ? 2
            : 3;
    };
    return (
      bucket(left) - bucket(right) ||
      leftLogin.localeCompare(rightLogin)
    );
  };
}

async function getLastSyncAt(userId: string): Promise<string | null> {
  const [lastSync] = await getDb()
    .select({
      finishedAt: syncRuns.finishedAt,
      startedAt: syncRuns.startedAt,
    })
    .from(syncRuns)
    .where(eq(syncRuns.userId, userId))
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);

  return (
    lastSync?.finishedAt?.toISOString() ??
    lastSync?.startedAt?.toISOString() ??
    null
  );
}

function toScoreSummary(
  storedScore: PeriodScoreSummary | null,
  period: string,
  rank: number | null,
): ScoreSummary {
  if (!storedScore) return emptyScore(period);

  return {
    period,
    score: Number(storedScore.score),
    rank,
    commits: storedScore.commits,
    kilometers: Math.round((storedScore.distanceMeters / 1000) * 10) / 10,
    lastSyncAt: null,
  };
}

async function getProfileHistory(
  userId: string,
  period: string,
): Promise<ProfileHistoryPoint[]> {
  return (await getProfileHistories([userId], period)).get(userId) ?? [];
}

async function getProfileHistories(
  userIds: string[],
  period: string,
): Promise<Map<string, ProfileHistoryPoint[]>> {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) return new Map();

  const { start, end } = periodBounds(period);
  const [commits, distances] = await Promise.all([
    getDb()
      .select({
        day: commitDays.day,
        count: commitDays.commitCount,
        userId: commitDays.userId,
      })
      .from(commitDays)
      .where(
        and(
          inArray(commitDays.userId, uniqueUserIds),
          gte(commitDays.day, start),
          lte(commitDays.day, end),
        ),
      ),
    getDb()
      .select({
        day: distanceDays.day,
        meters: distanceDays.meters,
        userId: distanceDays.userId,
      })
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

  const periodDays = periodDayCount(period);
  const commitsByUserId = groupDailyValues(
    commits,
    (row) => row.count,
  );
  const metersByUserId = groupDailyValues(
    distances,
    (row) => row.meters,
  );

  return new Map(
    uniqueUserIds.map((userId) => {
      const commitByDay = commitsByUserId.get(userId) ?? new Map();
      const metersByDay = metersByUserId.get(userId) ?? new Map();
      const days = [
        ...new Set([...commitByDay.keys(), ...metersByDay.keys()]),
      ].sort();
      let runningCommits = 0;
      let runningMeters = 0;
      const history = days.map((day) => {
        runningCommits += commitByDay.get(day) ?? 0;
        runningMeters += metersByDay.get(day) ?? 0;
        const kilometers = runningMeters / 1000;
        const activityScore = scoreActivity({
          commits: runningCommits,
          kilometers,
          periodDays,
        });

        return {
          date: day,
          commits: runningCommits,
          kilometers: Math.round(kilometers * 10) / 10,
          score: Number(activityScore.score.toFixed(6)),
        };
      });
      return [userId, history];
    }),
  );
}

function groupDailyValues<Row extends { day: string; userId: string }>(
  rows: Row[],
  value: (row: Row) => number,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const row of rows) {
    let days = result.get(row.userId);
    if (!days) {
      days = new Map();
      result.set(row.userId, days);
    }
    days.set(row.day, value(row));
  }
  return result;
}

function emptyMe(
  sessionUser: SessionUser | null,
  period: string,
): MeResponse {
  return {
    login: sessionUser?.login ?? "guest",
    displayName: sessionUser?.displayName ?? "Guest",
    publicLeaderboard: false,
    publicActivityHistory: false,
    publicHealthDataConsentVersion: null,
    publicHealthDataConsentedAt: null,
    streakDays: 0,
    units: "metric",
    score: emptyScore(period),
    github: emptyGitHubConnection(),
    devices: [],
  };
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

function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

function normalizeSearchLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}
