import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { users } from "@/server/db/schema";

export const currentPublicHealthDataConsentVersion = "public-health-v1";

export function hasCurrentPublicHealthDataConsent(user: {
  publicLeaderboard: boolean;
  publicHealthDataConsentVersion: string | null;
  publicHealthDataConsentedAt: Date | null;
  publicHealthDataConsentRevokedAt: Date | null;
}): boolean {
  return (
    user.publicLeaderboard &&
    user.publicHealthDataConsentVersion === currentPublicHealthDataConsentVersion &&
    user.publicHealthDataConsentedAt !== null &&
    user.publicHealthDataConsentRevokedAt === null
  );
}

export function currentPublicHealthDataConsentCondition() {
  return and(
    eq(users.publicLeaderboard, true),
    eq(users.publicHealthDataConsentVersion, currentPublicHealthDataConsentVersion),
    isNotNull(users.publicHealthDataConsentedAt),
    isNull(users.publicHealthDataConsentRevokedAt),
  );
}
