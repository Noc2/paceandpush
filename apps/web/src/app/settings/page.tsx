import { getSessionUser } from "@/server/auth/session";
import { getMe } from "@/server/data/read-model";
import { distanceUnitLabel } from "@/lib/distance-units";
import Link from "next/link";
import { AccountDataControls } from "./AccountDataControls";
import { GitHubConnectionControl } from "./GitHubConnectionControl";
import { LeaderboardVisibilityControl } from "./LeaderboardVisibilityControl";
import { MobileConnectPanel } from "./MobileConnectPanel";
import { ScoreExplainer } from "../ScoreExplainer";
import { SiteHeader } from "../SiteHeader";
import { SignOutControl } from "./SignOutControl";
import { UnitPreferenceControl } from "./UnitPreferenceControl";

type SettingsPageProps = {
  searchParams?: Promise<{
    github?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : {};
  const githubMessage = gitHubConnectionMessage(params.github);
  const me = await getMe(await getSessionUser());
  const activeDeviceCount = me.devices.filter((device) => !device.revoked).length;

  return (
    <main className="app-shell">
      <section className="app-frame profile-page" aria-label="Account settings">
        <SiteHeader compact>
          <Link className="button" href="/">
            Leaderboard
          </Link>
        </SiteHeader>

        <section className="profile-hero">
          <p className="section-label">Settings</p>
          <h1>@{me.login}</h1>
          <p>
            {me.login === "guest"
              ? "Sign in with GitHub to manage leaderboard visibility and devices."
              : `Public leaderboard is ${me.publicLeaderboard ? "on" : "off"}.`}
          </p>
        </section>

        {githubMessage ? (
          <p className="form-error" role="alert">
            {githubMessage}
          </p>
        ) : null}

        <ScoreExplainer />

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
          ) : (
            <GitHubConnectionControl initialGithub={me.github} />
          )}
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
          {me.login === "guest" ? (
            <SettingsRow label="Account data" value="Sign in to export or delete" />
          ) : (
            <AccountDataControls />
          )}
          {me.login === "guest" ? null : <SignOutControl />}
        </div>
      </section>
    </main>
  );
}

function gitHubConnectionMessage(code: string | undefined): string | null {
  switch (code) {
    case "connect_failed":
      return "GitHub connection failed. Please try connecting GitHub again.";
    case "invalid_callback":
      return "GitHub sign-in expired. Please start GitHub connection again.";
    default:
      return null;
  }
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
