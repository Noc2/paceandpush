import type { Metadata } from "next";
import { brandName } from "@paceandpush/brand";
import Link from "next/link";
import { legalEntity } from "@/lib/legal";
import { SiteHeader } from "@/app/SiteHeader";

export const metadata: Metadata = {
  title: `Privacy Policy | ${brandName}`,
  description: `Privacy information for ${brandName}.`,
};

export default function PrivacyPage() {
  return (
    <main className="app-shell legal-page">
      <section className="app-frame" aria-label="Privacy policy">
        <SiteHeader compact>
          <Link className="button" href="/">
            Leaderboard
          </Link>
        </SiteHeader>

        <section className="profile-hero">
          <p className="section-label">Legal</p>
          <h1>Privacy Policy</h1>
          <p>
            This policy explains how {brandName} processes account, coding, and
            distance data. Last updated: July 9, 2026.
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
              <li>
                OAuth scope information, a hash of the GitHub access token, and
                an encrypted copy of the token used for server-side refreshes.
              </li>
              <li>Session cookies used to keep you signed in.</li>
            </ul>

            <h3>GitHub activity</h3>
            <ul>
              <li>
                Daily GitHub commit counts and restricted/private contribution
                aggregates visible to your GitHub token and used for scoring.
              </li>
              <li>Metadata needed to refresh and explain score snapshots.</li>
              <li>
                {brandName} does not collect private repository source code for
                leaderboard scoring.
              </li>
            </ul>

            <h3>Distance sync</h3>
            <ul>
              <li>
                Daily aggregate distance totals sent by the iOS or Android app,
                bucketed by UTC calendar day.
              </li>
              <li>
                On iOS, Apple Health sync reads the current UTC calendar year
                only when preparing daily aggregate totals.
              </li>
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

            <h3>Website analytics</h3>
            <ul>
              <li>
                Aggregate website analytics from Simple Analytics, including
                page paths, referrers and UTM sources, country, language,
                device/browser information, viewport dimensions, scroll depth,
                and time on page.
              </li>
              <li>
                Simple Analytics is not used for advertising or cross-site
                tracking and does not set analytics cookies for this site.
              </li>
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
              <li>
                Aggregate website analytics: legitimate interests in
                understanding public website usage and improving the service
                without advertising or cross-site tracking.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Public Leaderboard Data</h2>
            <p>
              Public leaderboard visibility is off by default. You can opt in
              during app onboarding or later in settings. When it is on, the
              public leaderboard and profile pages may show your
              GitHub username, display name, score, rank, GitHub commit total,
              distance total, streak, and score history. Commit totals may include
              restricted/private contribution aggregates that GitHub makes visible
              to your signed-in account.
            </p>
          </section>

          <section className="legal-section">
            <h2>Scoring and Ranking</h2>
            <p>
              {brandName} calculates period scores from daily GitHub commit
              counts, restricted/private contribution aggregates visible to your
              GitHub token, and daily aggregate distance totals bucketed by UTC
              calendar day. The score is used to rank public users on the
              leaderboard. This ranking is for the product experience only and
              does not produce legal or similarly significant effects.
            </p>
          </section>

          <section className="legal-section">
            <h2>Processors and Recipients</h2>
            <ul>
              <li>
                Vercel for hosting, edge delivery, serverless application
                execution, deployment logs, and operational security.
              </li>
              <li>Neon for Postgres database hosting, backups, and database operations.</li>
              <li>
                GitHub for OAuth sign-in and GitHub API data. GitHub also acts
                independently for your GitHub account and GitHub service data.
              </li>
              <li>
                Apple for App Store/TestFlight distribution and HealthKit
                permission surfaces. Apple HealthKit remains a local platform
                permission system; the iOS app sends only aggregate distance
                totals to {brandName}.
              </li>
              <li>
                Google for Google Play distribution and Android Health Connect
                permission surfaces. Health Connect remains a local platform
                permission system; the Android app sends only aggregate distance
                totals to {brandName}.
              </li>
              <li>
                Simple Analytics for privacy-friendly aggregate website
                analytics on the Next.js web app. Simple Analytics is not used
                for advertising or cross-site tracking.
              </li>
            </ul>
            <p>
              Where Vercel or Neon process personal data on our behalf, we rely
              on their applicable data-processing terms, subprocessor controls,
              technical and organizational measures, and cross-border transfer
              mechanisms. For transfers outside the EEA, United Kingdom, or
              Switzerland, safeguards may include adequacy decisions, Standard
              Contractual Clauses or equivalent transfer terms, and supplemental
              security measures such as data minimization, encryption in transit,
              token hashing, and encrypted credential storage.
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
                Sync-run status records and score history are kept while your
                account is active so the product can show sync state, score
                history, and troubleshooting context.
              </li>
              <li>
                Operational server logs are kept only as long as needed for
                security, reliability, abuse prevention, and debugging, and are
                not used for advertising or marketing.
              </li>
              <li>
                Signed-in users can export data through{" "}
                <code>/api/me/privacy-export</code>.
              </li>
              <li>
                Signed-in users can request deletion through{" "}
                <code>DELETE /api/me/delete</code>; this removes account,
                GitHub, device, commit, distance, score, and sync records.
                Backup copies and provider logs may persist for a limited period
                under provider retention cycles, but are not restored to active
                service except for disaster recovery or legal/security needs.
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
              signed-in session. Simple Analytics is enabled without analytics
              cookies. No marketing or behavioral advertising cookies are
              currently used.
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
              {brandName} stores GitHub access tokens encrypted at rest when the
              product needs to refresh commit counts, keeps token hashes for
              audit and export metadata, minimizes health-derived uploads to
              daily totals, and keeps device authentication separate from GitHub
              sign-in. Production controls include HTTPS, strict transport
              security headers, database-backed device revocation, hashed mobile
              bearer tokens, production-only secret checks, and a health endpoint
              for operational monitoring. Security or privacy concerns can be
              sent to {legalEntity.email}.
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

          <section className="legal-section">
            <h2>Policy Updates</h2>
            <p>
              This policy will be updated before {brandName} enables
              advertising, error monitoring, paid plans, background sync, raw
              workout collection, GPS route collection, changes analytics
              provider or collection mode, or adds any new third-party provider
              that materially changes how personal data is processed.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
