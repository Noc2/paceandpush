import type { PublicHealthDataConsentRequest } from "@paceandpush/api-contracts";
import {
  deleteAccountData,
  type AccountUser,
  updateAccountSettings,
} from "@/server/data/accounts";
import {
  hidePublicLogin,
  publishAndShowPublicLogin,
  publishPublicPeriods,
  removeProjectedProfiles,
} from "@/server/data/public-discovery-cache";
import {
  getScorePeriodsForUser,
  refreshDirtyScorePeriodsForUser,
  refreshGitHubCommitsForUser,
  scorePeriodsRequiredForRefresh,
} from "@/server/data/scores";
import { currentPeriod } from "@/lib/periods";

export async function updateAccountSettingsWithPublicProjection({
  user,
  publicLeaderboard,
  publicHealthDataConsent,
  units,
}: {
  user: AccountUser;
  publicLeaderboard?: boolean;
  publicHealthDataConsent?: PublicHealthDataConsentRequest;
  units?: "metric" | "imperial";
}): Promise<AccountUser> {
  if (typeof publicLeaderboard !== "boolean") {
    return updateAccountSettings({
      userId: user.id,
      publicHealthDataConsent,
      units,
    });
  }

  // The projection is the authority for anonymous reads. Hide before touching
  // Neon so stale or concurrently rebuilt projections cannot expose a user
  // during a privacy transition.
  const visibilityToken = await hidePublicLogin(user.login);
  const existingPeriods = await getScorePeriodsForUser(user.id, [
    currentPeriod(),
  ]);
  const updatedUser = await updateAccountSettings({
    userId: user.id,
    publicLeaderboard,
    publicHealthDataConsent,
    units,
  });

  if (!updatedUser.publicLeaderboard) {
    await cleanupHiddenProjection(updatedUser.login, existingPeriods);
    return updatedUser;
  }

  await refreshGitHubCommitsForUser({
    userId: updatedUser.id,
    login: updatedUser.login,
  });
  const scoreRefresh = await refreshDirtyScorePeriodsForUser(updatedUser.id, [
    ...existingPeriods,
    ...scorePeriodsRequiredForRefresh(currentPeriod()),
  ]);
  await publishAndShowPublicLogin(
    updatedUser.login,
    scoreRefresh.periods,
    visibilityToken,
  );
  return updatedUser;
}

export async function deleteAccountWithPublicProjection(
  user: Pick<AccountUser, "id" | "login">,
): Promise<string[]> {
  await hidePublicLogin(user.login);
  const affectedPeriods = await getScorePeriodsForUser(user.id, [
    currentPeriod(),
  ]);
  await deleteAccountData(user.id);
  await cleanupHiddenProjection(user.login, affectedPeriods);
  return affectedPeriods;
}

async function cleanupHiddenProjection(
  login: string,
  periods: string[],
): Promise<void> {
  // These writes are housekeeping: the tombstone above is the privacy
  // authority and remains in place even if cleanup fails.
  try {
    await removeProjectedProfiles(login, periods);
    await publishPublicPeriods(periods);
  } catch (error) {
    console.error("[public-projection] hidden user cleanup failed", error);
  }
}
