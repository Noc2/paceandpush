import { upsertDistanceDays, verifyDeviceToken } from "@/server/data/mobile";
import { recomputeScoreSnapshots } from "@/server/data/scores";
import { periodForKind } from "@/lib/periods";
import type {
  DistanceDayInput,
  DistanceDaysRequest,
} from "@paceandpush/api-contracts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const auth = await verifyDeviceToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid device token." }, { status: 401 });
  }

  let body: DistanceDaysRequest;
  try {
    body = (await request.json()) as DistanceDaysRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.days)) {
    return NextResponse.json({ error: "days must be an array." }, { status: 400 });
  }
  if (body.days.length > 45) {
    return NextResponse.json({ error: "days may include at most 45 entries." }, { status: 400 });
  }

  const accepted = body.days
    .filter((day) => isValidDistanceDay(day, auth.device.platform))
    .map((day) => ({
      ...day,
      meters: Math.round(day.meters),
      flagged: isImplausibleDistanceDay(day),
    }));
  const canonicalDays = canonicalDistanceDays(accepted);

  await upsertDistanceDays({ auth, days: canonicalDays });
  const scorePeriods = scorePeriodsForDistanceDays(canonicalDays);
  const recomputeResults = await Promise.allSettled(
    scorePeriods.map((period) => recomputeScoreSnapshots(period)),
  );
  const failedPeriods = scorePeriods.filter(
    (_, index) => recomputeResults[index]?.status === "rejected",
  );

  if (failedPeriods.length > 0) {
    console.error("[mobile] distance score recompute failed", {
      periods: failedPeriods,
      errors: recomputeResults
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason),
    });
  }

  return NextResponse.json({
    accepted: canonicalDays.length,
    flagged:
      body.days.length - accepted.length + canonicalDays.filter((day) => day.flagged).length,
    ...(failedPeriods.length > 0 ? { warnings: ["score_recompute_failed"] } : {}),
  });
}

function isValidDistanceDay(
  day: DistanceDayInput,
  expectedPlatform: "ios" | "android",
): boolean {
  const date = new Date(`${day.date}T00:00:00.000Z`);
  return (
    Number.isFinite(date.valueOf()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
    Number.isFinite(day.meters) &&
    day.meters >= 0 &&
    day.meters <= 250_000 &&
    day.sourcePlatform === expectedPlatform &&
    typeof day.sourceHash === "string" &&
    day.sourceHash.length >= 8
  );
}

function isImplausibleDistanceDay(day: DistanceDayInput): boolean {
  return day.meters > 100_000;
}

function canonicalDistanceDays(
  days: Array<DistanceDayInput & { flagged: boolean }>,
): Array<DistanceDayInput & { flagged: boolean }> {
  const daysByDate = new Map<string, DistanceDayInput & { flagged: boolean }>();

  for (const day of days) {
    daysByDate.set(day.date, day);
  }

  return [...daysByDate.values()];
}

function scorePeriodsForDistanceDays(
  days: Array<DistanceDayInput & { flagged: boolean }>,
): string[] {
  const periods = new Set<string>();

  for (const day of days) {
    const date = new Date(`${day.date}T00:00:00.000Z`);
    periods.add(periodForKind("week", date));
    periods.add(periodForKind("month", date));
    periods.add(periodForKind("year", date));
  }

  return [...periods].sort();
}
