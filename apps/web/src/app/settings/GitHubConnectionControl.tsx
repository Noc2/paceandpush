"use client";

import type { GitHubConnectionSummary } from "@paceandpush/api-contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiError = {
  error?: string;
};

export function GitHubConnectionControl({
  initialGithub,
}: {
  initialGithub: GitHubConnectionSummary;
}) {
  const router = useRouter();
  const [github, setGithub] = useState(initialGithub);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"refresh" | "disconnect" | null>(null);
  const canDisconnect = github.connected || github.needsReconnect;
  const status = github.connected
    ? "Connected"
    : github.needsReconnect
      ? "Reconnect required"
      : "Disconnected";

  async function refreshData() {
    if (!github.connected || busyAction) return;
    setBusyAction("refresh");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/me/github/refresh", { method: "POST" });
      const body = (await response.json()) as ApiError & { refreshedAt?: string };
      if (!response.ok) {
        throw new Error(body.error || "Could not refresh GitHub data.");
      }

      setGithub((current) => ({
        ...current,
        updatedAt: body.refreshedAt ?? current.updatedAt,
      }));
      setMessage("GitHub data refreshed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not refresh GitHub data.");
    } finally {
      setBusyAction(null);
    }
  }

  async function disconnectGithub() {
    if (!canDisconnect || busyAction) return;
    if (!window.confirm("Disconnect GitHub and clear stored commit data?")) return;

    setBusyAction("disconnect");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/me/github/disconnect", { method: "DELETE" });
      const body = (await response.json()) as ApiError & {
        github?: GitHubConnectionSummary;
      };
      if (!response.ok) {
        throw new Error(body.error || "Could not disconnect GitHub.");
      }

      setGithub(body.github ?? { connected: false, needsReconnect: false, updatedAt: null });
      setMessage("GitHub disconnected.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not disconnect GitHub.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="settings-row github-setting">
      <span>GitHub</span>
      <div>
        <div className="github-setting-status">
          <strong>{status}</strong>
          {github.updatedAt ? <span>Last updated {formatDateTime(github.updatedAt)}</span> : null}
        </div>
        <div className="settings-actions">
          <a className="button button-primary" href="/api/github/oauth/start">
            {github.connected ? "Reconnect GitHub" : "Connect GitHub"}
          </a>
          <button
            className="button"
            type="button"
            onClick={refreshData}
            disabled={!github.connected || busyAction !== null}
          >
            {busyAction === "refresh" ? "Refreshing..." : "Refresh data"}
          </button>
          <button
            className="button danger-button"
            type="button"
            onClick={disconnectGithub}
            disabled={!canDisconnect || busyAction !== null}
          >
            {busyAction === "disconnect" ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
        {message ? <p className="form-success">{message}</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
