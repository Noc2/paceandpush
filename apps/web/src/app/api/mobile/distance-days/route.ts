import { upsertDistanceDays, verifyDeviceToken } from "@/server/data/mobile";
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

  const accepted = body.days
    .filter((day) => isValidDistanceDay(day, auth.device.platform))
    .map((day) => ({
      ...day,
      meters: Math.round(day.meters),
      flagged: isImplausibleDistanceDay(day),
    }));

  await upsertDistanceDays({ auth, days: accepted });

  return NextResponse.json({
    accepted: accepted.length,
    flagged:
      body.days.length - accepted.length + accepted.filter((day) => day.flagged).length,
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
