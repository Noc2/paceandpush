import { getSessionUser } from "@/server/auth/session";
import { getMe } from "@/server/data/read-model";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(getMe(await getSessionUser()));
}
