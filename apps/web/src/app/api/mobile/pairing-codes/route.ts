import { getSessionUser } from "@/server/auth/session";
import { rateLimit } from "@/server/api/rate-limit";
import { getAccountUser } from "@/server/data/accounts";
import { createMobilePairingCode } from "@/server/data/mobile";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    bucket: "mobile-pairing-code",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  return NextResponse.json(await createMobilePairingCode({ userId: user.id }));
}
