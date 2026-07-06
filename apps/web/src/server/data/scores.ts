import { scoreCohort, type Board } from "@paceandpush/api-contracts";
import { getDb } from "@/server/db/client";
import { commitDays, distanceDays, scoreSnapshots, users } from "@/server/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

const dailyCommitCap = 50;
const dayMs = 24 * 60 * 60 * 1000;

interface ScoreTotals {
  userId: string;
  commits: number;
  kilometers: number;
  publicLeaderboard: boolean;
}

interface GitHubEvent {
  type?: string;
  created_at?: string;
  payload?: {
    commits?: unknown[];
    head?: string;
  };
}

export function currentPeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function periodBounds(period: string): { start: string; end: string } {
  const yearMatch = /^(\d{4})$/.exec(period);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return {
      start: toDateString(new Date(Date.UTC(year, 0, 1))),
      end: toDateString(new Date(Date.UTC(year, 11, 31))),
    };
  }

  const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    return {
      start: toDateString(new Date(Date.UTC(year, month - 1, 1))),
      end: toDateString(new Date(Date.UTC(year, month, 0))),
    };
  }

  const weekMatch = /^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/.exec(period);
  if (weekMatch) {
    const start = isoWeekStart(Number(weekMatch[1]), Number(weekMatch[2]));
    if (toIsoWeekPeriod(start) !== period) {
      throw new Error("period uses an invalid ISO week.");
    }
    return {
      start: toDateString(start),
      end: toDateString(addDays(start, 6)),
    };
  }

  throw new Error("period must use YYYY, YYYY-MM, or YYYY-Www format.");
}

export function isSupportedPeriod(period: string): boolean {
  try {
    periodBounds(period);
    return true;
  } catch {
    return false;
  }
}

export function parsePeriod(value: string | null | undefined): string {
  if (value && isSupportedPeriod(value)) {
    return value;
  }
  return currentPeriod();
}

function isoWeekStart(year: number, week: number): Date {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const day = januaryFourth.getUTCDay() || 7;
  return addDays(januaryFourth, 1 - day + (week - 1) * 7);
}

function toIsoWeekPeriod(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);

  const isoYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / dayMs) + 1) / 7);

  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * dayMs);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function refreshPublicGitHubCommits(period = currentPeriod()): Promise<{
  checked: number;
  updatedDays: number;
  errors: Array<{ login: string; message: string }>;
}> {
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      login: users.login,
    })
    .from(users);

  let updatedDays = 0;
  const errors: Array<{ login: string; message: string }> = [];

  for (const user of rows) {
    try {
      const result = await refreshPublicGitHubCommitsForUser({
        userId: user.id,
        login: user.login,
        period,
      });
      updatedDays += result.updatedDays;
    } catch (error) {
      errors.push({
        login: user.login,
        message: error instanceof Error ? error.message : "GitHub refresh failed.",
      });
    }
  }

  return {
    checked: rows.length,
    updatedDays,
    errors,
  };
}

export async function refreshPublicGitHubCommitsForUser({
  userId,
  login,
  period = currentPeriod(),
}: {
  userId: string;
  login: string;
  period?: string;
}): Promise<{ updatedDays: number }> {
  const { start, end } = periodBounds(period);
  const dayCounts = await fetchPublicCommitDays(login, start, end);
  if (dayCounts.size === 0) return { updatedDays: 0 };

  await getDb()
    .insert(commitDays)
    .values(
      [...dayCounts.entries()].map(([day, count]) => ({
        userId,
        day,
        commitCount: Math.min(count, dailyCommitCap),
        sourceMetadata: {
          source: "github_public_events",
          cappedAt: dailyCommitCap,
          fallback: "push_events_without_commit_payload_count_as_one",
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

  return { updatedDays: dayCounts.size };
}

export async function recomputeScoreSnapshots(period = currentPeriod()): Promise<{
  period: string;
  users: number;
  snapshots: number;
}> {
  const totals = await getScoreTotals(period);
  const scoredRows = scoreCohort(totals);
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
            normalizedCommits: row.normalizedCommits.toFixed(6),
            normalizedKilometers: row.normalizedKilometers.toFixed(6),
            balancedScore: row.score.toFixed(2),
            rank: rankByUserId.get(row.userId) ?? null,
          })
          .onConflictDoUpdate({
            target: [scoreSnapshots.userId, scoreSnapshots.period, scoreSnapshots.board],
            set: {
              commitTotal: row.commits,
              distanceMetersTotal: Math.round(row.kilometers * 1000),
              normalizedCommits: row.normalizedCommits.toFixed(6),
              normalizedKilometers: row.normalizedKilometers.toFixed(6),
              balancedScore: row.score.toFixed(2),
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
  if (publicLeaderboard) {
    try {
      await refreshPublicGitHubCommitsForUser({ userId, login, period });
    } catch (error) {
      console.error("[scores] public GitHub refresh after leaderboard opt-in failed", error);
    }
  }

  await recomputeScoreSnapshots(period);
}

async function getScoreTotals(period: string): Promise<ScoreTotals[]> {
  const db = getDb();
  const { start, end } = periodBounds(period);
  const [userRows, commitRows, distanceRows] = await Promise.all([
    db
      .select({
        id: users.id,
        publicLeaderboard: users.publicLeaderboard,
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
      (commitsByUser.get(row.userId) ?? 0) + Math.min(row.commitCount, dailyCommitCap),
    );
  }

  for (const row of distanceRows) {
    metersByUser.set(row.userId, (metersByUser.get(row.userId) ?? 0) + row.meters);
  }

  return userRows.map((user) => ({
    userId: user.id,
    publicLeaderboard: user.publicLeaderboard,
    commits: commitsByUser.get(user.id) ?? 0,
    kilometers: Math.round(((metersByUser.get(user.id) ?? 0) / 1000) * 10) / 10,
  }));
}

function compareBoardRows(
  board: Board,
  left: ScoreTotals & { score: number },
  right: ScoreTotals & { score: number },
): number {
  if (board === "commits") return right.commits - left.commits;
  if (board === "distance") return right.kilometers - left.kilometers;
  return right.score - left.score;
}

async function fetchPublicCommitDays(
  login: string,
  start: string,
  end: string,
): Promise<Map<string, number>> {
  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(login)}/events/public?per_page=100`,
    {
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub public events returned ${response.status}`);
  }

  const events = (await response.json()) as GitHubEvent[];
  const dayCounts = new Map<string, number>();

  for (const event of events) {
    if (event.type !== "PushEvent" || !event.created_at) continue;

    const day = event.created_at.slice(0, 10);
    if (day < start || day > end) continue;

    const commitCount = getPushEventCommitCount(event);
    if (commitCount === 0) continue;

    dayCounts.set(day, (dayCounts.get(day) ?? 0) + commitCount);
  }

  return dayCounts;
}

function getPushEventCommitCount(event: GitHubEvent): number {
  if (Array.isArray(event.payload?.commits)) {
    return event.payload.commits.length;
  }

  if (event.payload?.head && /^0+$/.test(event.payload.head)) {
    return 0;
  }

  return 1;
}
