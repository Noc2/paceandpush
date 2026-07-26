import { getAccountUser } from "@/server/data/accounts";
import { verifyDeviceToken } from "@/server/data/mobile";
import { deleteAccountWithPublicProjection } from "@/server/privacy/public-visibility";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest) {
  const auth = await verifyDeviceToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid device token." }, { status: 401 });
  }

  const account = await getAccountUser({
    githubId: auth.user.githubId,
    login: auth.user.login,
    displayName: auth.user.displayName,
    avatarUrl: auth.user.avatarUrl,
  });
  if (!account) {
    return NextResponse.json({ error: "Account does not exist." }, { status: 404 });
  }
  await deleteAccountWithPublicProjection(account);

  return NextResponse.json({
    login: auth.user.login,
    status: "deleted",
    deletedAt: new Date().toISOString(),
  });
}
