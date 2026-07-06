"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiError = {
  error?: string;
};

export function SignOutControl() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const body = (await response.json()) as ApiError;
      if (!response.ok) {
        throw new Error(body.error || "Could not sign out.");
      }
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-row sign-out-control">
      <span>Session</span>
      <div>
        <button className="button" type="button" onClick={signOut} disabled={busy}>
          {busy ? "Signing out..." : "Sign out"}
        </button>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
