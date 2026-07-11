import { exchangeMobilePairingCode } from "@/server/data/mobile";
import { rateLimit } from "@/server/api/rate-limit";
import type { DeviceExchangeRequest } from "@paceandpush/api-contracts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    bucket: "mobile-device-pairing",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  let body: DeviceExchangeRequest;
  try {
    body = (await request.json()) as DeviceExchangeRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  try {
    if (
      body.publicLeaderboard !== undefined &&
      typeof body.publicLeaderboard !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Public leaderboard preference must be a boolean." },
        { status: 400 },
      );
    }
    return NextResponse.json(await exchangeMobilePairingCode(body));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid pairing request." },
      { status: 400 },
    );
  }
}
