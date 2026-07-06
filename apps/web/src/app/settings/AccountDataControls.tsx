"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiError = {
  error?: string;
};

export function AccountDataControls() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (busy) return;
    if (
      !window.confirm(
        "Delete your Pace & Push account, connected devices, score history, and synced distance totals?",
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/me/delete", { method: "DELETE" });
      const body = (await response.json()) as ApiError;
      if (!response.ok) {
        throw new Error(body.error || "Could not delete account data.");
      }
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete account data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-row account-data-controls">
      <span>Account data</span>
      <div>
        <div className="settings-actions">
          <a className="button" href="/api/me/privacy-export">
            Export data
          </a>
          <button
            className="button danger-button"
            type="button"
            onClick={deleteAccount}
            disabled={busy}
          >
            {busy ? "Deleting..." : "Delete account"}
          </button>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
