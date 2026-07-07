import { exchangeMobileAuthCode } from "@/server/data/mobile";
import { rateLimit } from "@/server/api/rate-limit";
import { mobileAuthExchangeErrorMessage } from "@/server/mobile/callback-errors";
import type { MobileAuthExchangeRequest } from "@paceandpush/api-contracts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    bucket: "mobile-auth-exchange",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  let body: MobileAuthExchangeRequest;
  try {
    body = (await request.json()) as MobileAuthExchangeRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  try {
    if (!body.code || !body.codeVerifier) {
      return NextResponse.json({ error: "Code and code verifier are required." }, { status: 400 });
    }

    return NextResponse.json(
      await exchangeMobileAuthCode({
        code: body.code,
        codeVerifier: body.codeVerifier,
      }),
    );
  } catch (error) {
    console.error("[mobile-auth-exchange] exchange failed", error);
    return NextResponse.json(
      { error: mobileAuthExchangeErrorMessage(error) },
      { status: 400 },
    );
  }
}
