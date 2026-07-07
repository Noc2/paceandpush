import { recordSyncRun, verifyDeviceToken } from "@/server/data/mobile";
import { isSyncRunRequest } from "@/server/api/payloads";
import type { SyncRunRequest } from "@paceandpush/api-contracts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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

  if (!isSyncRunRequest(body, auth.device.platform)) {
    return NextResponse.json({ error: "Invalid sync run payload." }, { status: 400 });
  }

  return NextResponse.json(await recordSyncRun({ auth, run: body }));
}
