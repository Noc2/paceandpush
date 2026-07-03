import { randomUUID } from "node:crypto";
import { verifyDeviceToken } from "@/server/mobile/tokens";
import type { SyncRunRequest, SyncStatus } from "@paceandpush/api-contracts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const auth = verifyDeviceToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid device token." }, { status: 401 });
  }

  let body: SyncRunRequest;
  try {
    body = (await request.json()) as SyncRunRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  if (!isValidSyncRun(body, auth.device.platform)) {
    return NextResponse.json({ error: "Invalid sync run payload." }, { status: 400 });
  }

  return NextResponse.json({
    id: randomUUID(),
    status: body.status,
  });
}

function isValidSyncRun(
  run: SyncRunRequest,
  expectedPlatform: "ios" | "android",
): boolean {
  return (
    run.platform === expectedPlatform &&
    isSyncStatus(run.status) &&
    Number.isFinite(Date.parse(run.startedAt)) &&
    (run.finishedAt === null || Number.isFinite(Date.parse(run.finishedAt))) &&
    typeof run.counters === "object" &&
    run.counters !== null
  );
}

function isSyncStatus(status: string): status is SyncStatus {
  return status === "success" || status === "warning" || status === "error";
}
