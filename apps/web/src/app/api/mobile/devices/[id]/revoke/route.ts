import { getSessionUser } from "@/server/auth/session";
import { getAccountUser } from "@/server/data/accounts";
import { revokeMobileDevice } from "@/server/data/mobile";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getAccountUser(await getSessionUser());
  if (!user) {
    return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
  }

  const { id } = await context.params;
  const device = await revokeMobileDevice({ id, userId: user.id });
  if (!device) {
    return NextResponse.json({ error: "Device not found." }, { status: 404 });
  }

  return NextResponse.json(device);
}
