import { exportAccountData } from "@/server/data/accounts";
import { verifyDeviceToken } from "@/server/data/mobile";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await verifyDeviceToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid device token." }, { status: 401 });
  }

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      data: await exportAccountData(auth.user.id),
      notes: ["Daily running distance totals are exported without raw workouts."],
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
