# Privacy Policy Notes

The public privacy policy now lives in the web app at
`apps/web/src/app/privacy/page.tsx` and is linked from the global footer at
`/privacy`.

## Current Coverage

- GitHub identity: GitHub id, username, display name, and avatar URL.
- GitHub activity summaries: daily commit counts and restricted/private
  contribution aggregates used for scoring.
- GitHub OAuth credentials: token hash plus encrypted access token for
  server-side score refresh.
- Distance summaries: daily running distance totals from HealthKit or Health
  Connect. On iOS, Apple Health sync reads the current UTC calendar year only
  when preparing daily aggregate totals.
- Device sync metadata: platform, device label, sync status, and timestamps.
- Session cookies and OAuth state cookies.
- Private-first sync state; versioned consent and timestamps for the public
  exact-summary bundle; withdrawal state; and a separate default-off dated
  activity-history preference.
- Data export and deletion controls.
- Website analytics through Simple Analytics, including aggregate page paths,
  referrers/UTM sources, country, language, device/browser information,
  viewport dimensions, scroll depth, and time on page.

## Data We Do Not Collect In The PoC

- Raw workouts.
- GPS routes.
- Step-by-step health samples.
- Private repository source code.
- Payment information.

## Production Legal Position

- Privacy/legal contact: `hawigxyz@proton.me`.
- Processor position: Vercel hosts and executes the web application; Neon hosts
  the Postgres database. Where they process personal data on behalf of Pace &
  Push, the production position is to rely on their applicable data-processing
  terms, subprocessor controls, technical and organizational measures, and
  cross-border transfer mechanisms.
- Platform-recipient position: GitHub provides OAuth and API data and also acts
  independently for GitHub account/service data. Apple and Google provide app
  distribution and native health-permission surfaces; HealthKit and Health
  Connect remain local platform permission systems.
- Simple Analytics is enabled for privacy-friendly website analytics on the
  Next.js web app. It is not used for advertising or cross-site tracking and
  does not set analytics cookies for this site.
- No advertising or error-monitoring provider is currently enabled. Update the
  policy before adding one.
- Retention position: account, commit, distance, device, score, and sync records
  are kept while the account is active and are deleted from the application
  database on account deletion, subject to limited provider backup/log retention
  cycles.
