import { persistMobileDevice } from "@/server/data/mobile";
import { decodeDeviceToken, exchangePairingCode } from "@/server/mobile/tokens";
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
    const deviceExchange = exchangePairingCode(body);
    const decodedToken = decodeDeviceToken(`Bearer ${deviceExchange.token}`);
    if (!decodedToken) {
      throw new Error("Pairing exchange did not create a valid device token.");
    }
    await persistMobileDevice({
      deviceExchange,
      githubId: decodedToken.payload.sub,
    });
    return NextResponse.json(deviceExchange);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid pairing request." },
      { status: 400 },
    );
  }
}
