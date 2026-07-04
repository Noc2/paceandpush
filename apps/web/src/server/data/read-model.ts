import type {
  Board,
  LeaderboardResponse,
  MeResponse,
  ProfileHistoryPoint,
  PublicProfileResponse,
  ScoreSummary,
} from "@paceandpush/api-contracts";
import type { SessionUser } from "@/server/auth/session";
import { getAccountUser } from "@/server/data/accounts";
import { listMobileDevices } from "@/server/data/mobile";
import {
  currentPeriod,
  recomputeScoreSnapshots,
  refreshPublicGitHubCommitsForUser,
} from "@/server/data/scores";
import { getDb, isDatabaseConfigured } from "@/server/db/client";
import { commitDays, distanceDays, scoreSnapshots, syncRuns, users } from "@/server/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

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

  const rows = await getDb()
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
        eq(users.publicLeaderboard, true),
      ),
    )
    .orderBy(scoreSnapshots.rank);

  return {
    period,
    board,
    rows: await Promise.all(
      rows.map(async (row, index) => ({
        rank: row.rank ?? index + 1,
        login: row.login,
        displayName: row.displayName,
        score: Number(row.score),
        commits: row.commits,
        kilometers: Math.round((row.distanceMeters / 1000) * 10) / 10,
        streakDays: await getStreakDays(row.userId, period),
      })),
    ),
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
    .where(and(eq(sql`lower(${users.login})`, login.toLowerCase()), eq(users.publicLeaderboard, true)))
    .limit(1);

  if (!user) return null;

  const score = await getScoreSummary(user.id, period);

  return {
    login: user.login,
    displayName: user.displayName,
    bio: user.bio,
    score,
    history: await getProfileHistory(user.id, period, score.score),
  };
}

export async function getMe(sessionUser: SessionUser | null): Promise<MeResponse> {
  const period = currentPeriod();

  if (!isDatabaseConfigured()) {
    return {
      login: sessionUser?.login ?? "guest",
      displayName: sessionUser?.displayName ?? "Guest",
      publicLeaderboard: false,
      units: "metric",
      score: emptyScore(period),
      devices: [],
    };
  }

  const account = await getAccountUser(sessionUser);

  if (!account) {
    return {
      login: sessionUser?.login ?? "guest",
      displayName: sessionUser?.displayName ?? "Guest",
      publicLeaderboard: false,
      units: "metric",
      score: emptyScore(period),
      devices: [],
    };
  }

  const score = await getInitialScoreSummary(account, period);

  return {
    login: account.login,
    displayName: account.displayName,
    publicLeaderboard: account.publicLeaderboard,
    units: account.units,
    score,
    devices: await listMobileDevices(account.id),
  };
}

export function parseBoard(value: string | null): Board {
  if (value === "commits" || value === "distance" || value === "balanced") {
    return value;
  }
  return "balanced";
}

async function getScoreSummary(userId: string, period: string): Promise<ScoreSummary> {
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

async function getInitialScoreSummary(
  account: NonNullable<Awaited<ReturnType<typeof getAccountUser>>>,
  period: string,
): Promise<ScoreSummary> {
  if (await hasScoreSnapshot(account.id, period)) {
    return getScoreSummary(account.id, period);
  }

  try {
    await refreshPublicGitHubCommitsForUser({
      userId: account.id,
      login: account.login,
      period,
    });
    await recomputeScoreSnapshots(period);
  } catch (error) {
    console.error("[scores] initial signed-in score refresh failed", error);
  }

  return getScoreSummary(account.id, period);
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
  const { start, end } = getPeriodBounds(period);
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

async function getStreakDays(userId: string, period: string): Promise<number> {
  const { start, end } = getPeriodBounds(period);
  const [commits, distances] = await Promise.all([
    getDb()
      .select({ day: commitDays.day })
      .from(commitDays)
      .where(
        and(
          eq(commitDays.userId, userId),
          gte(commitDays.day, start),
          lte(commitDays.day, end),
        ),
      ),
    getDb()
      .select({ day: distanceDays.day })
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
  const activeDays = new Set([...commits, ...distances].map((row) => row.day));
  const sortedDays = [...activeDays].sort().reverse();
  if (sortedDays.length === 0) return 0;

  let streak = 1;
  let previous = new Date(`${sortedDays[0]}T00:00:00.000Z`);

  for (const day of sortedDays.slice(1)) {
    const current = new Date(`${day}T00:00:00.000Z`);
    const diffDays = (previous.getTime() - current.getTime()) / (24 * 60 * 60 * 1000);
    if (diffDays !== 1) break;
    streak += 1;
    previous = current;
  }

  return streak;
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

function getPeriodBounds(period: string): { start: string; end: string } {
  const [year, month] = period.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}
