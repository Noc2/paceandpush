# Pace & Push Implementation Plan

Pace & Push is a Vercel-hosted web app plus native iOS and Android apps. The
mobile apps are first-class product clients: they show the user's score,
leaderboards, profile, and sync status, while also providing native HealthKit
and Health Connect data ingestion.

## Product Scope

### Core Experience

- Show a balanced Pace & Push score based on GitHub commits and running
  kilometers.
- Show week, month, and year leaderboards for:
  - Balanced score
  - Commits
  - Run kilometers
- Show user profiles with commit, distance, and score history.
- Show users on the public leaderboard by default, with clear opt-out controls.
- Let users delete their Pace & Push data and revoke mobile devices.
- Let native apps connect to GitHub directly through backend-mediated OAuth and
  store Pace & Push mobile device tokens securely. Keep web-generated pairing
  codes as a fallback/manual testing path.

### Clients

- `apps/web`: public website, GitHub sign-in, mobile OAuth broker,
  leaderboard, profiles, settings, companion-app listing, device pairing
  fallback, and onboarding.
- `apps/ios`: native SwiftUI app with HealthKit sync and the same score,
  leaderboard, profile, and settings basics as the website.
- `apps/android`: native Kotlin/Compose app with Health Connect sync and the
  same score, leaderboard, profile, and settings basics as the website.
- `packages/api-contracts`: shared TypeScript schemas for public API request and
  response payloads used by web, iOS, and Android, plus generated OpenAPI/JSON
  Schema artifacts or checked fixtures for native model parity.
- `packages/brand`: shared prompt-mark assets and design tokens for the web and
  native app implementations.

## Technical Shape

### Web and Backend

- Next.js App Router deployed on Vercel.
- Neon Postgres with Drizzle.
- Route handlers for mobile API, GitHub OAuth, sync ingestion, and cron jobs.
- Vercel Cron for GitHub contribution refresh and score materialization.
- Lazy server-side initialization for database and SDK clients so Vercel builds
  do not require runtime secrets at module load time.
- Shared prompt-mark brand assets, sparse leaderboard-first UI, and no mascot or
  character art.

### iOS

- Native SwiftUI.
- Blocking onboarding for GitHub connection, HealthKit permission, and first
  sync before the score tabs are shown.
- GitHub sign-in through `ASWebAuthenticationSession` and a native URL scheme.
- HealthKit authorization for running workouts.
- Keychain storage for mobile API credentials.
- Score, leaderboard, profile, sync, and settings tabs.
- Manual sync first, then background delivery where feasible.

### Android

- Native Kotlin with Jetpack Compose.
- Health Connect permissions for exercise sessions and distance.
- Read running exercise sessions first, then aggregate distance inside those
  session windows to reduce non-running distance leakage.
- Encrypted storage for mobile API credentials.
- Score, leaderboard, profile, sync, and settings tabs.
- Manual sync first, then WorkManager background sync.

## Data Model

Initial tables:

- `users`: GitHub identity, display name, avatar, visibility settings.
- `github_accounts`: GitHub IDs, login, access token metadata.
- `mobile_devices`: user ID, platform, device label, token hash, revoked state.
- `commit_days`: user ID, date, commit count, source metadata.
- `distance_days`: user ID, date, running meters, source platform, source hash.
- `score_snapshots`: user ID, period, commit total, distance total, normalized
  metrics, balanced score, rank metadata.
- `sync_runs`: source, status, timestamps, counters, error summary.

## Scoring

For the PoC, score each selected period by normalizing commits and kilometers
inside the visible cohort, then combining them with a geometric mean:

```txt
score = sqrt(normalized_commits * normalized_kilometers)
```

This keeps the product identity balanced: commits without movement and movement
without commits both underperform on the balanced board, while still allowing
separate commits-only and kilometers-only boards.

Guardrails:

- Cap counted commit contributions per day.
- Count running distance only for the balanced score.
- Flag implausible daily running distance for review rather than silently
  removing it.
- Keep public leaderboard participation user-controllable, defaulting to public.

## Mobile App MVP Screens

Both native apps should ship these screens in the PoC:

- Today: current period score, commits, kilometers, rank, and last sync time.
- Leaderboard: tabs for Balanced, Commits, and Run kilometers.
- Profile: own profile chart plus public profile view for other users.
- Sync: health permission state, synced date range, sync now button, recent sync
  results.
- Settings: public leaderboard visibility, units, connected GitHub account,
  disconnect device, delete all data.

## API Surface

Initial endpoints:

- `GET /api/me`: current account, settings, score summary.
- `GET /api/leaderboard?period=YYYY|YYYY-MM|YYYY-Www&board=balanced|commits|distance`
- `GET /api/users/:login`: public profile and history.
- `GET /api/mobile/auth/github/start`: start backend-mediated native GitHub
  OAuth and redirect to GitHub.
- `GET /api/github/oauth/callback/mobile`: complete GitHub OAuth, create the
  Pace & Push device, and redirect back to the native URL scheme.
- `POST /api/mobile/auth/exchange`: exchange the native auth code for a mobile
  device bearer token.
- `GET /api/mobile/me`: current account, settings, score summary, and devices
  using bearer mobile auth.
- `PATCH /api/mobile/me/settings`: update current account settings using bearer
  mobile auth.
- `GET /api/mobile/me/profile`: private current-user profile using bearer
  mobile auth.
- `POST /api/mobile/pairing-codes`: create a short-lived pairing code fallback.
- `POST /api/mobile/devices`: exchange pairing code for a mobile API token.
- `POST /api/mobile/distance-days`: upsert signed daily running distance
  summaries.
- `POST /api/mobile/sync-runs`: record sync status.
- `POST /api/github/oauth/callback`: GitHub OAuth callback.
- `GET /api/cron/github-sync`: Vercel Cron GitHub refresh.
- `GET /api/cron/score-snapshots`: Vercel Cron score materialization.

### Web Mobile Onboarding

- The leaderboard/home surface lists the iOS and Android companion apps and
  explains that they are the HealthKit/Health Connect running distance sources.
- Settings includes a device connection section for signed-in users.
- The connection section creates a short-lived pairing code through
  `/api/mobile/pairing-codes`, shows the expiry, and lists connected devices.
- Users can revoke paired devices from the same settings section.

## Research Notes

- Strava is not a launch dependency. Its 2026 API agreement adds display and
  disclosure restrictions that make public Strava-powered leaderboards risky.
- Native HealthKit and Health Connect running workout sync makes Pace & Push
  less dependent on a single fitness social graph.
- Android Health Connect supports foreground and background reads; Pace & Push
  uses running exercise sessions as the activity filter before aggregating
  cumulative distance.
- Android Health Connect background reads and reading history older than the
  default lookback require extra permissions, so the PoC should start with
  foreground manual sync and short history windows.
- Google Play health permission review expects clear user benefit, minimum
  requested data types, prominent disclosure, privacy policy coverage, and
  security practices.
- Apple HealthKit remains a native-app API, so a pure web app cannot be the only
  ingestion path for Apple Health data.
- Apple App Review treats health and fitness data as especially sensitive. The
  product must disclose collected health data and must not use it for
  advertising, marketing, or data mining.
- Vercel monorepos should deploy `apps/web` as the project root. Cron jobs are
  configured through `vercel.json` and invoked as HTTP GET requests.
- Vercel Postgres is no longer a new-project product; use a Marketplace
  Postgres provider such as Neon.

Useful references:

- Apple HealthKit: https://developer.apple.com/documentation/healthkit
- Android Health Connect: https://developer.android.com/health-and-fitness/health-connect
- Android Health Connect read data: https://developer.android.com/health-and-fitness/health-connect/read-data
- Android Health Connect aggregate data: https://developer.android.com/health-and-fitness/health-connect/aggregate-data
- Google Play health permissions: https://support.google.com/googleplay/android-developer/answer/12991134
- Apple App Review health rules: https://developer.apple.com/app-store/review/guidelines/#health-and-health-research
- GitHub OAuth scopes: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- Vercel Git deployments: https://vercel.com/docs/git
- Vercel monorepos: https://vercel.com/docs/monorepos
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Vercel domains: https://vercel.com/docs/domains/working-with-domains/add-a-domain

## Commit Plan

1. `chore: scaffold monorepo for web ios android`
   - Initialize repo structure.
   - Add `apps/web`, `apps/ios`, `apps/android`, and `packages/api-contracts`.
   - Add minimal SwiftUI and Compose app shells that can evolve from the first
     scaffold.
   - Add basic docs, formatting, env examples, and CI/build placeholders.

2. `feat: add shared brand tokens and prompt logo`
   - Add the `>` prompt mark as a reusable asset.
   - Add palette, typography, and spacing tokens.
   - Document that the brand has no mascot or character art.

3. `feat: define shared api contracts and score model`
   - Add schemas for leaderboard rows, profile responses, mobile sync payloads,
     and score summaries.
   - Add OpenAPI/JSON Schema output or fixtures for Swift/Kotlin model parity.
   - Add score calculation helpers and unit tests.

4. `feat: add backend schema for users scores and devices`
   - Add Drizzle schema and migrations.
   - Model users, GitHub accounts, mobile devices, commit days, distance days,
     score snapshots, and sync runs.

5. `feat: add github auth and account identity`
   - Implement GitHub OAuth.
   - Store GitHub identity.
   - Add session handling and account settings.

6. `feat: add mobile pairing and device token auth`
   - Add short-lived pairing-code creation and exchange.
   - Add mobile device token hashing and verification.
   - Add device revocation support used by Settings.

7. `feat: add leaderboard profile and me APIs`
   - Implement read APIs used by all clients.
   - Return seeded data until real sync lands.
   - Add API tests for ranking, period filtering, and privacy filtering.

8. `feat: add mobile distance ingestion and sync runs`
   - Add mobile-authenticated ingestion endpoint.
   - Validate payloads and source hashes.
   - Upsert daily summaries idempotently.
   - Record sync runs.

9. `feat: build ios app shell with pairing and read APIs`
   - Add SwiftUI tab structure.
   - Show Today, Leaderboard, Profile, Sync, and Settings views from the shared
     API.
   - Add pairing flow and secure token storage.

10. `feat: build android app shell with pairing and read APIs`
   - Add Compose navigation and tab structure.
   - Show Today, Leaderboard, Profile, Sync, and Settings views from the shared
     API.
   - Add pairing flow and encrypted token storage.

11. `feat: add ios HealthKit running distance sync`
   - Request HealthKit permissions.
   - Read running workout distance.
   - Preview daily summaries before upload.
   - Add manual sync.

12. `feat: add android Health Connect running distance sync`
    - Check Health Connect availability.
    - Request required permissions.
    - Read running exercise sessions and aggregate distance inside them.
    - Add manual sync.

13. `feat: build web leaderboard and profile views`
    - Build the leaderboard-first web experience using the sparse developer-tool
      direction and shared prompt mark.
    - Add homepage leaderboard, profile page, settings, and empty states.

14. `feat: add charts privacy controls and delete flows`
    - Add score, commits, and kilometers history to web, iOS, and Android.
    - Show sync status and recent errors consistently.
    - Add public leaderboard visibility controls.
    - Add device revocation.
    - Add delete-all data flow and clear user-facing copy.

15. `feat: add web mobile app onboarding`
    - List the iOS and Android companion apps on the website.
    - Add the web pairing-code generation flow.
    - Show connected mobile devices and revoke controls in Settings.

16. `chore: prepare vercel and mobile beta launch`
    - Configure Vercel project and domain checklist for `paceandpush.com`.
    - Add TestFlight and internal Android testing docs.
    - Add privacy policy and health permission rationale.
    - Add launch smoke-test checklist.

## PoC Acceptance Criteria

- A user can sign in with GitHub on the web.
- The website lists the iOS and Android companion apps and explains how running
  distance reaches Pace & Push.
- A signed-in web user can generate a pairing code and review connected devices.
- A user can pair iOS and Android apps to the same account.
- The mobile apps show score, leaderboard, profile, settings, and sync state.
- iOS can read native HealthKit running workout distance and upload daily
  summaries.
- Android can read native Health Connect running exercise distance and upload
  daily summaries.
- The web and mobile clients show the same leaderboard and profile data.
- Public leaderboard participation is opt-in.
- The prompt-mark identity is consistent across web, iOS, and Android.
- The project deploys to Vercel and is ready to attach `paceandpush.com`.
