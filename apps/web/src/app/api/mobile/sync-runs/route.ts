import { recordSyncRun, verifyDeviceToken } from "@/server/data/mobile";
import type { SyncRunRequest, SyncStatus } from "@paceandpush/api-contracts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const auth = await verifyDeviceToken(request.headers.get("authorization"));
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

  return NextResponse.json(await recordSyncRun({ auth, run: body }));
}

function isValidSyncRun(
  run: SyncRunRequest,
  expectedPlatform: "ios" | "android",
): boolean {
  const startedAt = Date.parse(run.startedAt);
  const finishedAt = run.finishedAt === null ? null : Date.parse(run.finishedAt);
  const counters = Object.entries(run.counters ?? {});

  return (
    run.platform === expectedPlatform &&
    isSyncStatus(run.status) &&
    Number.isFinite(startedAt) &&
    (finishedAt === null || (Number.isFinite(finishedAt) && finishedAt >= startedAt)) &&
    typeof run.counters === "object" &&
    run.counters !== null &&
    counters.length <= 20 &&
    counters.every(([, value]) => Number.isFinite(value) && value >= 0) &&
    (run.errorSummary === undefined || run.errorSummary.length <= 500)
  );
}

function isSyncStatus(status: string): status is SyncStatus {
  return status === "success" || status === "warning" || status === "error";
}
