import { scoreActivity } from "@paceandpush/api-contracts";
import { and, asc, eq, gte, lte, or, sql } from "drizzle-orm";
import { periodBounds, periodDayCount } from "@/lib/periods";
import { calculateStreakDays } from "@/lib/streaks";
import { getDb } from "@/server/db/client";
import {
  commitDays,
  dirtyScorePeriods,
  distanceDays,
  periodScores,
} from "@/server/db/schema";

type DirtyScorePeriodClaim = {
  period: string;
  revision: number;
  userId: string;
};

export type PeriodScoreRefreshResult = {
  periods: string[];
  scores: number;
  userId: string;
};

export type DirtyScorePeriodDrainResult = {
  failed: Array<{ message: string; periods: string[]; userId: string }>;
  processed: number;
  refreshed: PeriodScoreRefreshResult[];
  users: number;
};

export async function refreshUserPeriodScores(
  userId: string,
  periods: Iterable<string>,
): Promise<PeriodScoreRefreshResult> {
  const uniquePeriods = uniqueSortedPeriods(periods);
  if (uniquePeriods.length === 0) {
    return { periods: [], scores: 0, userId };
  }

  const periodSpecs = uniquePeriods.map((period) => ({
    period,
    ...periodBounds(period),
    days: periodDayCount(period),
  }));
  const rangeStart = periodSpecs.reduce(
    (earliest, period) => period.start < earliest ? period.start : earliest,
    periodSpecs[0].start,
  );
  const rangeEnd = periodSpecs.reduce(
    (latest, period) => period.end > latest ? period.end : latest,
    periodSpecs[0].end,
  );
  const db = getDb();
  const [commits, distances] = await Promise.all([
    db
      .select({
        count: commitDays.commitCount,
        day: commitDays.day,
      })
      .from(commitDays)
      .where(
        and(
          eq(commitDays.userId, userId),
          gte(commitDays.day, rangeStart),
          lte(commitDays.day, rangeEnd),
        ),
      ),
    db
      .select({
        day: distanceDays.day,
        meters: distanceDays.meters,
      })
      .from(distanceDays)
      .where(
        and(
          eq(distanceDays.userId, userId),
          gte(distanceDays.day, rangeStart),
          lte(distanceDays.day, rangeEnd),
          eq(distanceDays.flagged, false),
        ),
      ),
  ]);
  const now = new Date();
  const rows = periodSpecs.map(({ days, end, period, start }) => {
    const periodCommits = commits.filter((row) => row.day >= start && row.day <= end);
    const periodDistances = distances.filter((row) => row.day >= start && row.day <= end);
    const commitTotal = Math.max(
      0,
      periodCommits.reduce((total, row) => total + row.count, 0),
    );
    const distanceMetersTotal = Math.max(
      0,
      periodDistances.reduce((total, row) => total + row.meters, 0),
    );
    const activeDays = new Set<string>();

    for (const row of periodCommits) {
      if (row.count > 0) activeDays.add(row.day);
    }
    for (const row of periodDistances) {
      if (row.meters > 0) activeDays.add(row.day);
    }

    const activity = scoreActivity({
      commits: commitTotal,
      kilometers: distanceMetersTotal / 1000,
      periodDays: days,
    });

    return {
      userId,
      period,
      commitTotal,
      distanceMetersTotal,
      commitComponent: activity.commitComponent.toFixed(6),
      distanceComponent: activity.distanceComponent.toFixed(6),
      score: activity.score.toFixed(6),
      streakDays: calculateStreakDays(activeDays),
      updatedAt: now,
    };
  });

  await db
    .insert(periodScores)
    .values(rows)
    .onConflictDoUpdate({
      target: [periodScores.userId, periodScores.period],
      set: {
        commitTotal: sql`excluded.commit_total`,
        distanceMetersTotal: sql`excluded.distance_meters_total`,
        commitComponent: sql`excluded.commit_component`,
        distanceComponent: sql`excluded.distance_component`,
        score: sql`excluded.score`,
        streakDays: sql`excluded.streak_days`,
        updatedAt: now,
      },
    });

  return {
    periods: uniquePeriods,
    scores: rows.length,
    userId,
  };
}

export async function drainDirtyScorePeriods({
  limit = 100,
  userId,
}: {
  limit?: number;
  userId?: string;
} = {}): Promise<DirtyScorePeriodDrainResult> {
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit) || 1, 1), 500);
  const db = getDb();
  const selection = db
    .select({
      period: dirtyScorePeriods.period,
      revision: dirtyScorePeriods.revision,
      userId: dirtyScorePeriods.userId,
    })
    .from(dirtyScorePeriods)
    .orderBy(asc(dirtyScorePeriods.requestedAt))
    .limit(normalizedLimit);
  const claims = userId
    ? await selection.where(eq(dirtyScorePeriods.userId, userId))
    : await selection;
  const claimsByUserId = groupClaimsByUserId(claims);
  const failed: DirtyScorePeriodDrainResult["failed"] = [];
  const refreshed: PeriodScoreRefreshResult[] = [];
  let processed = 0;

  for (const [claimedUserId, userClaims] of claimsByUserId) {
    try {
      const result = await refreshUserPeriodScores(
        claimedUserId,
        userClaims.map((claim) => claim.period),
      );
      await deleteClaimedDirtyPeriods(userClaims);
      refreshed.push(result);
      processed += userClaims.length;
    } catch (error) {
      failed.push({
        message: error instanceof Error ? error.message : "Score refresh failed.",
        periods: userClaims.map((claim) => claim.period),
        userId: claimedUserId,
      });
    }
  }

  return {
    failed,
    processed,
    refreshed,
    users: claimsByUserId.size,
  };
}

export async function refreshDirtyScorePeriodsForUser(
  userId: string,
  extraPeriods: Iterable<string> = [],
): Promise<PeriodScoreRefreshResult> {
  const claims = await getDb()
    .select({
      period: dirtyScorePeriods.period,
      revision: dirtyScorePeriods.revision,
      userId: dirtyScorePeriods.userId,
    })
    .from(dirtyScorePeriods)
    .where(eq(dirtyScorePeriods.userId, userId));
  const periods = uniqueSortedPeriods([
    ...extraPeriods,
    ...claims.map((claim) => claim.period),
  ]);
  const result = await refreshUserPeriodScores(userId, periods);
  await deleteClaimedDirtyPeriods(claims);
  return result;
}

async function deleteClaimedDirtyPeriods(
  claims: DirtyScorePeriodClaim[],
): Promise<void> {
  if (claims.length === 0) return;

  const conditions = claims.map((claim) =>
    and(
      eq(dirtyScorePeriods.userId, claim.userId),
      eq(dirtyScorePeriods.period, claim.period),
      eq(dirtyScorePeriods.revision, claim.revision),
    )
  );
  const condition = conditions.length === 1 ? conditions[0] : or(...conditions);
  if (!condition) return;

  await getDb().delete(dirtyScorePeriods).where(condition);
}

function groupClaimsByUserId(
  claims: DirtyScorePeriodClaim[],
): Map<string, DirtyScorePeriodClaim[]> {
  const grouped = new Map<string, DirtyScorePeriodClaim[]>();

  for (const claim of claims) {
    const existing = grouped.get(claim.userId);
    if (existing) {
      existing.push(claim);
    } else {
      grouped.set(claim.userId, [claim]);
    }
  }

  return grouped;
}

function uniqueSortedPeriods(periods: Iterable<string>): string[] {
  return [...new Set(periods)].sort();
}
