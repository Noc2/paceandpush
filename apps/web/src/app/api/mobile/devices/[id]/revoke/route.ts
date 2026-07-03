import { getSessionUser } from "@/server/auth/session";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  const { id } = await context.params;
  return NextResponse.json({ id, revoked: true });
}
