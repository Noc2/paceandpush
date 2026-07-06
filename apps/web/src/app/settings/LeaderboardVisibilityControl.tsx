"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LeaderboardVisibilityControl({
  initialPublicLeaderboard,
}: {
  initialPublicLeaderboard: boolean;
}) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialPublicLeaderboard);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function updateVisibility(nextIsPublic: boolean) {
    if (nextIsPublic === isPublic || isSaving) return;

    const previousIsPublic = isPublic;
    setIsPublic(nextIsPublic);
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/me/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicLeaderboard: nextIsPublic }),
      });

      if (!response.ok) {
        setIsPublic(previousIsPublic);
        setError("Could not save leaderboard visibility.");
        return;
      }

      const body = (await response.json()) as { publicLeaderboard?: boolean };
      setIsPublic(Boolean(body.publicLeaderboard));
      router.refresh();
    } catch {
      setIsPublic(previousIsPublic);
      setError("Could not save leaderboard visibility.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="settings-row setting-control">
      <span>Leaderboard</span>
      <div>
        <label className="switch-control">
          <input
            type="checkbox"
            checked={isPublic}
            disabled={isSaving}
            onChange={(event) => updateVisibility(event.currentTarget.checked)}
          />
          <span aria-hidden="true" />
          <strong>{isPublic ? "Public" : "Private"}</strong>
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
