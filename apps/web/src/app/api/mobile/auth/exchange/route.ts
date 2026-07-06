import { exchangeMobileAuthCode } from "@/server/data/mobile";
import { mobileAuthExchangeErrorMessage } from "@/server/mobile/callback-errors";
import type { MobileAuthExchangeRequest } from "@paceandpush/api-contracts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: MobileAuthExchangeRequest;
  try {
    body = (await request.json()) as MobileAuthExchangeRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  try {
    return NextResponse.json(await exchangeMobileAuthCode({ code: body.code }));
  } catch (error) {
    console.error("[mobile-auth-exchange] exchange failed", error);
    return NextResponse.json(
      { error: mobileAuthExchangeErrorMessage(error) },
      { status: 400 },
    );
  }
}
