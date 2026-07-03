import { getSessionUser } from "@/server/auth/session";
import { getMe } from "@/server/data/read-model";
import { brandName, brandTagline, promptMark } from "@paceandpush/brand";
import Link from "next/link";

export default async function SettingsPage() {
  const me = await getMe(await getSessionUser());

  return (
    <main className="app-shell">
      <section className="app-frame profile-page" aria-label="Account settings">
        <header className="topbar">
          <Link href="/" className="brand-lockup" aria-label={brandName}>
            <span className="logo-mark" aria-hidden="true">
              {promptMark.character}
            </span>
            <span>
              <strong>{brandName}</strong>
              <small>{brandTagline}</small>
            </span>
          </Link>
          <Link className="button" href="/">
            Leaderboard
          </Link>
        </header>

        <section className="profile-hero">
          <p className="section-label">Settings</p>
          <h1>@{me.login}</h1>
          <p>
            {me.login === "guest"
              ? "Sign in with GitHub to manage leaderboard visibility and devices."
              : `Public leaderboard is ${me.publicLeaderboard ? "on" : "off"}.`}
          </p>
        </section>

        <div className="settings-list">
          {me.login === "guest" ? (
            <Link className="button button-primary settings-cta" href="/api/github/oauth/start">
              Connect GitHub
            </Link>
          ) : null}
          <SettingsRow label="Leaderboard" value={me.publicLeaderboard ? "Public" : "Private"} />
          <SettingsRow label="Units" value={me.units} />
          <SettingsRow label="Devices" value={`${me.devices.length} connected`} />
          <SettingsRow label="Data export" value="/api/me/privacy-export" />
          <SettingsRow label="Delete request" value="DELETE /api/me/delete" />
        </div>
      </section>
    </main>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
