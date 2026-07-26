import { upsertDistanceDays, verifyDeviceToken } from "@/server/data/mobile";
import { publishPublicPeriods } from "@/server/data/public-discovery-cache";
import { refreshDirtyScorePeriodsForUser } from "@/server/data/scores";
import { rateLimit } from "@/server/api/rate-limit";
import { isDistanceDayInput, isPlainObject } from "@/server/api/payloads";
import type { DistanceDayInput } from "@paceandpush/api-contracts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    bucket: "mobile-distance-days",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const auth = await verifyDeviceToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid device token." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  if (!isPlainObject(body) || !Array.isArray(body.days)) {
    return NextResponse.json({ error: "days must be an array." }, { status: 400 });
  }
  const days = body.days;
  if (days.length > 45) {
    return NextResponse.json({ error: "days may include at most 45 entries." }, { status: 400 });
  }

  const accepted = days
    .filter((day): day is DistanceDayInput => isDistanceDayInput(day, auth.device.platform))
    .map((day) => ({
      ...day,
      meters: Math.round(day.meters),
      flagged: isImplausibleDistanceDay(day),
    }));
  const canonicalDays = canonicalDistanceDays(accepted);

  await upsertDistanceDays({ auth, days: canonicalDays });
  let refreshedPeriods: string[] = [];
  const warnings: string[] = [];

  try {
    const scoreRefresh = await refreshDirtyScorePeriodsForUser(auth.user.id);
    refreshedPeriods = scoreRefresh.periods;
  } catch (error) {
    warnings.push("score_refresh_failed");
    console.error("[mobile] distance score refresh failed", error);
  }

  if (refreshedPeriods.length > 0) {
    try {
      await publishPublicPeriods(refreshedPeriods);
    } catch (error) {
      warnings.push("public_projection_refresh_failed");
      console.error("[mobile] distance public projection refresh failed", error);
    }
  }

  return NextResponse.json({
    accepted: canonicalDays.length,
    flagged:
      days.length - accepted.length + canonicalDays.filter((day) => day.flagged).length,
    refreshedPeriods,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
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
