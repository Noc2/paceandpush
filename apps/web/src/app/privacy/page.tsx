import type { Metadata } from "next";
import { brandName, brandTagline, promptMark } from "@paceandpush/brand";
import Link from "next/link";
import { legalEntity } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Privacy Policy | ${brandName}`,
  description: `Privacy information for ${brandName}.`,
};

export default function PrivacyPage() {
  return (
    <main className="app-shell legal-page">
      <section className="app-frame" aria-label="Privacy policy">
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
          <p className="section-label">Legal</p>
          <h1>Privacy Policy</h1>
          <p>
            This policy explains how {brandName} processes account, coding, and
            distance data. Last updated: July 5, 2026.
          </p>
        </section>

        <div className="legal-content">
          <section className="legal-section">
            <h2>Controller</h2>
            <address>
              <strong>{legalEntity.displayName}</strong>
              {legalEntity.displayAddress.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
            <p>Privacy contact: {legalEntity.email}</p>
          </section>

          <section className="legal-section">
            <h2>Data We Process</h2>
            <h3>GitHub sign-in</h3>
            <ul>
              <li>GitHub id, username, display name, and avatar URL.</li>
              <li>OAuth scope information and a hash of the GitHub access token.</li>
              <li>Session cookies used to keep you signed in.</li>
            </ul>

            <h3>GitHub activity</h3>
            <ul>
              <li>Daily public commit counts used for scoring.</li>
              <li>Metadata needed to refresh and explain score snapshots.</li>
              <li>
                {brandName} does not collect private repository source code for
                leaderboard scoring.
              </li>
            </ul>

            <h3>Distance sync</h3>
            <ul>
              <li>Daily aggregate distance totals sent by the iOS or Android app.</li>
              <li>Device label, platform, sync timestamps, status, and error summaries.</li>
              <li>
                {brandName} does not collect raw workouts, GPS routes, or
                step-by-step HealthKit or Health Connect samples.
              </li>
              <li>
                Daily distance totals are health- and fitness-derived data and
                are treated as sensitive data for product and review purposes.
              </li>
            </ul>

            <h3>Profile and settings</h3>
            <ul>
              <li>Leaderboard visibility, unit preference, and public profile data.</li>
              <li>Score snapshots, ranks, streaks, and profile history.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Purposes and Legal Bases</h2>
            <ul>
              <li>
                Account operation, authentication, settings, and device pairing:
                performance of the service contract.
              </li>
              <li>
                Distance totals from HealthKit or Health Connect: your explicit
                mobile permission and consent, plus service operation where needed.
              </li>
              <li>
                Public leaderboard/profile display: your leaderboard visibility
                setting and service operation.
              </li>
              <li>
                Health- and fitness-derived distance totals: your explicit
                permission in HealthKit or Health Connect and your consent to
                sync aggregate distance totals to {brandName}.
              </li>
              <li>
                Security, abuse prevention, reliability, and debugging:
                legitimate interests in operating a safe service.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Public Leaderboard Data</h2>
            <p>
              Public leaderboard visibility is on by default for new accounts,
              and you can turn it off during app onboarding or in settings. When
              it is on, the public leaderboard and profile pages may show your
              GitHub username, display name, score, rank, commit total, distance
              total, streak, and score history.
            </p>
          </section>

          <section className="legal-section">
            <h2>Scoring and Ranking</h2>
            <p>
              {brandName} calculates a monthly score from daily public commit
              counts and daily aggregate distance totals. The score is used to
              rank opted-in users on the leaderboard. This ranking is for the
              product experience only and does not produce legal or similarly
              significant effects.
            </p>
          </section>

          <section className="legal-section">
            <h2>Processors and Recipients</h2>
            <ul>
              <li>Vercel for hosting and serverless application execution.</li>
              <li>Neon for Postgres database hosting.</li>
              <li>GitHub for OAuth sign-in and GitHub API data.</li>
              <li>
                Apple HealthKit and Android Health Connect remain local platform
                permission systems; the app sends only aggregate distance totals
                to {brandName}.
              </li>
            </ul>
            <p>
              International transfer safeguards, processor agreements, and final
              hosting locations must be confirmed before public launch.
            </p>
          </section>

          <section className="legal-section">
            <h2>Storage and Deletion</h2>
            <ul>
              <li>
                Account, commit, distance, device, score, and sync data are kept
                while your account is active or while needed to operate the service.
              </li>
              <li>
                Signed-in users can export data through{" "}
                <code>/api/me/privacy-export</code>.
              </li>
              <li>
                Signed-in users can request deletion through{" "}
                <code>DELETE /api/me/delete</code>; this removes account,
                GitHub, device, commit, distance, score, and sync records.
              </li>
              <li>
                You can withdraw mobile distance sync by revoking HealthKit or
                Health Connect permissions, disconnecting the device, or deleting
                your {brandName} account.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Cookies</h2>
            <p>
              {brandName} uses essential cookies for GitHub OAuth state and the
              signed-in session. No marketing or behavioral advertising cookies
              are currently used.
            </p>
          </section>

          <section className="legal-section">
            <h2>Your Rights</h2>
            <p>
              Depending on the situation, you may have rights to access,
              correction, deletion, restriction, portability, objection, and
              withdrawal of consent. You may also lodge a complaint with a data
              protection supervisory authority.
            </p>
          </section>

          <section className="legal-section">
            <h2>Security</h2>
            <p>
              {brandName} stores access tokens as hashes where the product does
              not need to recover the original value, minimizes health-derived
              uploads to daily totals, and keeps device authentication separate
              from GitHub sign-in. Final production security controls and
              incident-response contacts must be confirmed before public launch.
            </p>
          </section>

          <section className="legal-section">
            <h2>Children</h2>
            <p>
              {brandName} is not directed to children. If the service later
              targets minors or schools, the privacy policy and permission flows
              must be updated before launch.
            </p>
          </section>

          <section className="legal-section legal-warning">
            <h2>Launch checklist</h2>
            <p>
              Add a working privacy contact, confirm processor agreements and
              international transfer safeguards, finalize retention periods, and
              have this policy legally reviewed before public launch.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
