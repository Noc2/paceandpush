import { getSessionUser } from "@/server/auth/session";
import { getMe } from "@/server/data/read-model";
import { distanceUnitLabel } from "@/lib/distance-units";
import { brandName, brandTagline, promptMark } from "@paceandpush/brand";
import Link from "next/link";
import { LeaderboardVisibilityControl } from "./LeaderboardVisibilityControl";
import { MobileConnectPanel } from "./MobileConnectPanel";
import { UnitPreferenceControl } from "./UnitPreferenceControl";

export default async function SettingsPage() {
  const me = await getMe(await getSessionUser());
  const activeDeviceCount = me.devices.filter((device) => !device.revoked).length;

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

        <section
          id="mobile-apps"
          className="mobile-connect-section"
          aria-labelledby="mobile-apps-title"
        >
          <div>
            <p className="section-label">Companion apps</p>
            <h2 id="mobile-apps-title">Connect the mobile app</h2>
            <p>
              Generate a pairing code here, then paste it into the iOS or
              Android app to connect daily distance sync.
            </p>
          </div>
          {me.login === "guest" ? (
            <Link className="button button-primary settings-cta" href="/api/github/oauth/start">
              Connect GitHub
            </Link>
          ) : (
            <MobileConnectPanel initialDevices={me.devices} />
          )}
        </section>

        <div className="settings-list">
          {me.login === "guest" ? (
            <Link className="button button-primary settings-cta" href="/api/github/oauth/start">
              Connect GitHub
            </Link>
          ) : null}
          {me.login === "guest" ? (
            <SettingsRow label="Leaderboard" value="Private" />
          ) : (
            <LeaderboardVisibilityControl initialPublicLeaderboard={me.publicLeaderboard} />
          )}
          {me.login === "guest" ? (
            <SettingsRow label="Units" value={distanceUnitLabel(me.units)} />
          ) : (
            <UnitPreferenceControl initialUnits={me.units} />
          )}
          <SettingsRow label="Devices" value={`${activeDeviceCount} connected`} />
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
