import { exchangePairingCode } from "@/server/mobile/tokens";
import type { DeviceExchangeRequest } from "@paceandpush/api-contracts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: DeviceExchangeRequest;
  try {
    body = (await request.json()) as DeviceExchangeRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  try {
    return NextResponse.json(exchangePairingCode(body));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid pairing request." },
      { status: 400 },
    );
  }
}
