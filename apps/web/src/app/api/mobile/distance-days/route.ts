import { verifyDeviceToken } from "@/server/mobile/tokens";
import type {
  DistanceDayInput,
  DistanceDaysRequest,
} from "@paceandpush/api-contracts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const auth = verifyDeviceToken(request.headers.get("authorization"));
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

  const accepted = body.days.filter((day) => isValidDistanceDay(day, auth.device.platform));
  return NextResponse.json({
    accepted: accepted.length,
    flagged: body.days.length - accepted.length,
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
    day.sourceHash.length > 0
  );
}
