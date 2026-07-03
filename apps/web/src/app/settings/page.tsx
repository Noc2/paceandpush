import { getSessionUser } from "@/server/auth/session";
import { getMe } from "@/server/data/read-model";
import { brandName, brandTagline, promptMark } from "@paceandpush/brand";
import Link from "next/link";

export default async function SettingsPage() {
  const me = getMe(await getSessionUser());

  return (
    <main className="app-shell">
      <section className="app-frame profile-page" aria-label="Account settings">
        <header className="topbar">
          <Link href="/" className="brand-lockup" aria-label={brandName}>
            <img src={promptMark.assetPath} alt="" className="brand-mark" />
            <span>
              <strong>{brandName}</strong>
              <small>{brandTagline}</small>
            </span>
          </Link>
          <Link className="button" href="/">
            <span aria-hidden="true">&lt;</span>
            Board
          </Link>
        </header>

        <section className="profile-hero">
          <span className="avatar avatar-large">{initials(me.displayName)}</span>
          <div>
            <p className="section-label">Settings</p>
            <h1>@{me.login}</h1>
            <p>Public leaderboard is {me.publicLeaderboard ? "on" : "off"}.</p>
          </div>
        </section>

        <div className="settings-grid">
          <SettingsPanel title="Leaderboard" value={me.publicLeaderboard ? "Public" : "Private"}>
            <p>Balanced, commits, and distance boards use monthly public summaries.</p>
          </SettingsPanel>
          <SettingsPanel title="Units" value={me.units}>
            <p>Native apps can switch display units while the API stores metric totals.</p>
          </SettingsPanel>
          <SettingsPanel title="Data export" value="JSON">
            <a className="button" href="/api/me/privacy-export">
              Export data
            </a>
          </SettingsPanel>
          <SettingsPanel title="Delete request" value="Queued API">
            <code>DELETE /api/me/delete</code>
          </SettingsPanel>
        </div>
      </section>
    </main>
  );
}

function SettingsPanel({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <section className="metric-card settings-panel">
      <span>{title}</span>
      <strong>{value}</strong>
      <div>{children}</div>
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
