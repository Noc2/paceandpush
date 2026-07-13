"use client";

import {
  publicHealthDataConsentVersion,
  type AccountSettingsResponse,
} from "@paceandpush/api-contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SharingState = {
  isPublic: boolean;
  publicActivityHistory: boolean;
  consentVersion: string | null;
  consentedAt: string | null;
};

type LeaderboardVisibilityControlProps = {
  initialPublicLeaderboard: boolean;
  initialPublicActivityHistory: boolean;
  initialPublicHealthDataConsentVersion: string | null;
  initialPublicHealthDataConsentedAt: string | null;
};

export function LeaderboardVisibilityControl({
  initialPublicLeaderboard,
  initialPublicActivityHistory,
  initialPublicHealthDataConsentVersion,
  initialPublicHealthDataConsentedAt,
}: LeaderboardVisibilityControlProps) {
  const router = useRouter();
  const hasInitialCurrentConsent =
    initialPublicLeaderboard &&
    initialPublicHealthDataConsentVersion === publicHealthDataConsentVersion &&
    initialPublicHealthDataConsentedAt !== null;
  const [sharing, setSharing] = useState<SharingState>({
    isPublic: hasInitialCurrentConsent,
    publicActivityHistory: hasInitialCurrentConsent && initialPublicActivityHistory,
    consentVersion: hasInitialCurrentConsent ? initialPublicHealthDataConsentVersion : null,
    consentedAt: hasInitialCurrentConsent ? initialPublicHealthDataConsentedAt : null,
  });
  const [includeHistory, setIncludeHistory] = useState(
    hasInitialCurrentConsent ? initialPublicActivityHistory : false,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasCurrentConsent =
    sharing.isPublic &&
    sharing.consentVersion === publicHealthDataConsentVersion &&
    sharing.consentedAt !== null;
  const historyChanged =
    hasCurrentConsent && includeHistory !== sharing.publicActivityHistory;

  async function publishProfile() {
    if (isSaving || (hasCurrentConsent && !historyChanged)) return;

    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/me/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicLeaderboard: true,
          publicHealthDataConsent: {
            version: publicHealthDataConsentVersion,
            publishExactPeriodKilometers: true,
            publicActivityHistory: includeHistory,
          },
        }),
      });

      if (!response.ok) {
        setError("Could not publish your profile. Your previous privacy setting is unchanged.");
        return;
      }

      const body = (await response.json()) as AccountSettingsResponse;
      if (
        body.publicLeaderboard !== true ||
        body.publicActivityHistory !== includeHistory ||
        body.publicHealthDataConsentVersion !== publicHealthDataConsentVersion ||
        body.publicHealthDataConsentedAt === null
      ) {
        setError("The server did not confirm public sharing. Your previous setting is still shown.");
        return;
      }

      setSharing({
        isPublic: true,
        publicActivityHistory: body.publicActivityHistory,
        consentVersion: body.publicHealthDataConsentVersion,
        consentedAt: body.publicHealthDataConsentedAt,
      });
      router.refresh();
    } catch {
      setError("Could not publish your profile. Your previous privacy setting is unchanged.");
    } finally {
      setIsSaving(false);
    }
  }

  async function makeProfilePrivate() {
    if (!sharing.isPublic || isSaving) return;

    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/me/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicLeaderboard: false }),
      });

      if (!response.ok) {
        setIncludeHistory(sharing.publicActivityHistory);
        setError("Could not make your profile private. It may still be public; please try again.");
        return;
      }

      const body = (await response.json()) as AccountSettingsResponse;
      if (body.publicLeaderboard !== false || body.publicActivityHistory !== false) {
        setIncludeHistory(sharing.publicActivityHistory);
        setError("The server did not confirm withdrawal. Your profile may still be public.");
        return;
      }

      setSharing({
        isPublic: false,
        publicActivityHistory: false,
        consentVersion: body.publicHealthDataConsentVersion,
        consentedAt: body.publicHealthDataConsentedAt,
      });
      setIncludeHistory(false);
      router.refresh();
    } catch {
      setIncludeHistory(sharing.publicActivityHistory);
      setError("Could not make your profile private. It may still be public; please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="public-health-sharing-setting" aria-labelledby="public-sharing-title">
      <div className="public-sharing-heading">
        <div>
          <span className="section-label">Public health-data sharing</span>
          <h2 id="public-sharing-title">Exact running totals on your public profile</h2>
        </div>
        <strong className={hasCurrentConsent ? "sharing-status public" : "sharing-status"}>
          {hasCurrentConsent ? "Public" : "Private"}
        </strong>
      </div>

      <p>
        If you publish, anyone on the internet can view this information without a Pace &amp;
        Push account:
      </p>
      <ul>
        <li>Your GitHub login, display name, and bio.</li>
        <li>Your exact running distance in kilometers for the selected period.</li>
        <li>Your commit total, combined score, leaderboard rank, and streak.</li>
      </ul>
      <p className="public-sharing-warning">
        These running totals come from Apple Health or Health Connect. Other people can copy,
        save, or share information that you make public. Publishing is optional and you can
        withdraw it here at any time.
      </p>

      <label className="public-history-choice">
        <input
          type="checkbox"
          checked={includeHistory}
          disabled={isSaving}
          onChange={(event) => setIncludeHistory(event.currentTarget.checked)}
        />
        <span>
          <strong>Also publish dated activity history</strong>
          <small>
            Off by default. Daily cumulative points can reveal how far you ran on particular
            days, not just your period total.
          </small>
        </span>
      </label>

      <div className="public-sharing-actions">
        <button
          className="button button-primary"
          type="button"
          disabled={isSaving || (hasCurrentConsent && !historyChanged)}
          onClick={publishProfile}
        >
          {isSaving
            ? "Saving…"
            : hasCurrentConsent
              ? "Confirm updated sharing"
              : "Publish these totals"}
        </button>
        {sharing.isPublic ? (
          <button
            className="button danger-button"
            type="button"
            disabled={isSaving}
            onClick={makeProfilePrivate}
          >
            Make profile private
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
