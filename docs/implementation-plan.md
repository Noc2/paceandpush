# Pace & Push Implementation Plan

Pace & Push is a Vercel-hosted web app plus native iOS and Android apps. The
mobile apps are first-class product clients: they show the user's score,
leaderboards, profile, and sync status, while also providing native HealthKit
and Health Connect data ingestion.

## Product Scope

### Core Experience

- Show a balanced Pace & Push score based on GitHub commits and walking/running
  kilometers.
- Show monthly leaderboards for:
  - Balanced score
  - Commits
  - Kilometers
- Show user profiles with commit, distance, and score history.
- Let users opt into public leaderboard visibility.
- Let users delete their Pace & Push data and revoke mobile devices.

### Clients

- `apps/web`: public website, GitHub sign-in, leaderboard, profiles, settings,
  and onboarding.
- `apps/ios`: native SwiftUI app with HealthKit sync and the same score,
  leaderboard, profile, and settings basics as the website.
- `apps/android`: native Kotlin/Compose app with Health Connect sync and the
  same score, leaderboard, profile, and settings basics as the website.
- `packages/api-contracts`: shared TypeScript schemas for public API request and
  response payloads used by web, iOS, and Android.

## Technical Shape

### Web and Backend

- Next.js App Router deployed on Vercel.
- Neon Postgres with Drizzle.
- Route handlers for mobile API, GitHub OAuth, sync ingestion, and cron jobs.
- Vercel Cron for GitHub contribution refresh and score materialization.
- Lazy server-side initialization for database and SDK clients so Vercel builds
  do not require runtime secrets at module load time.

### iOS

- Native SwiftUI.
- HealthKit authorization for walking/running distance and workout distance.
- Keychain storage for mobile API credentials.
- Score, leaderboard, profile, sync, and settings tabs.
- Manual sync first, then background delivery where feasible.

### Android

- Native Kotlin with Jetpack Compose.
- Health Connect permissions for distance, steps where useful, and exercise
  sessions.
- Use aggregate reads for cumulative metrics to reduce double-counting risk.
- Encrypted storage for mobile API credentials.
- Score, leaderboard, profile, sync, and settings tabs.
- Manual sync first, then WorkManager background sync.

## Data Model

Initial tables:

- `users`: GitHub identity, display name, avatar, visibility settings.
- `github_accounts`: GitHub IDs, login, access token metadata.
- `mobile_devices`: user ID, platform, device label, token hash, revoked state.
- `commit_days`: user ID, date, commit count, source metadata.
- `distance_days`: user ID, date, meters, source platform, source hash.
- `score_snapshots`: user ID, period, commit total, distance total, normalized
  metrics, balanced score, rank metadata.
- `sync_runs`: source, status, timestamps, counters, error summary.

## Scoring

For the PoC, score each monthly period by normalizing commits and kilometers
inside the visible cohort, then combining them with a geometric mean:

```txt
score = sqrt(normalized_commits * normalized_kilometers)
```

This keeps the product identity balanced: commits without movement and movement
without commits both underperform on the balanced board, while still allowing
separate commits-only and kilometers-only boards.

Guardrails:

- Cap counted commit contributions per day.
- Count walking/running distance only for the balanced score.
- Flag implausible daily distance for review rather than silently removing it.
- Keep public leaderboard participation opt-in.

## Mobile App MVP Screens

Both native apps should ship these screens in the PoC:

- Today: current monthly score, commits, kilometers, rank, and last sync time.
- Leaderboard: tabs for Balanced, Commits, and Kilometers.
- Profile: own profile chart plus public profile view for other users.
- Sync: health permission state, synced date range, sync now button, recent sync
  results.
- Settings: public leaderboard opt-in, units, connected GitHub account,
  disconnect device, delete all data.

## API Surface

Initial endpoints:

- `GET /api/me`: current account, settings, score summary.
- `GET /api/leaderboard?period=YYYY-MM&board=balanced|commits|distance`
- `GET /api/users/:login`: public profile and history.
- `POST /api/mobile/pairing-codes`: create a short-lived pairing code.
- `POST /api/mobile/devices`: exchange pairing code for a mobile API token.
- `POST /api/mobile/distance-days`: upsert signed daily distance summaries.
- `POST /api/mobile/sync-runs`: record sync status.
- `POST /api/github/oauth/callback`: GitHub OAuth callback.
- `GET /api/cron/github-sync`: Vercel Cron GitHub refresh.
- `GET /api/cron/score-snapshots`: Vercel Cron score materialization.

## Research Notes

- Strava is not a launch dependency. Its 2026 API agreement adds display and
  disclosure restrictions that make public Strava-powered leaderboards risky.
- Native HealthKit and Health Connect make Pace & Push less dependent on a
  single fitness social graph.
- Android Health Connect supports foreground and background reads, and Google
  recommends aggregate reads for cumulative metrics.
- Apple HealthKit remains a native-app API, so a pure web app cannot be the only
  ingestion path for Apple Health data.

Useful references:

- Apple HealthKit: https://developer.apple.com/documentation/healthkit
- Android Health Connect: https://developer.android.com/health-and-fitness/health-connect
- Android Health Connect read data: https://developer.android.com/health-and-fitness/health-connect/read-data
- Android Health Connect aggregate data: https://developer.android.com/health-and-fitness/health-connect/aggregate-data
- GitHub OAuth scopes: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- Vercel Git deployments: https://vercel.com/docs/git
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Vercel domains: https://vercel.com/docs/domains/working-with-domains/add-a-domain

## Commit Plan

1. `chore: scaffold monorepo for web ios android`
   - Initialize repo structure.
   - Add `apps/web`, `apps/ios`, `apps/android`, and `packages/api-contracts`.
   - Add basic docs, formatting, env examples, and CI/build placeholders.

2. `feat: define shared api contracts and score model`
   - Add schemas for leaderboard rows, profile responses, mobile sync payloads,
     and score summaries.
   - Add score calculation helpers and unit tests.

3. `feat: add backend schema for users scores and devices`
   - Add Drizzle schema and migrations.
   - Model users, GitHub accounts, mobile devices, commit days, distance days,
     score snapshots, and sync runs.

4. `feat: add github auth and account identity`
   - Implement GitHub OAuth.
   - Store GitHub identity.
   - Add session handling and account settings.

5. `feat: add leaderboard and profile api endpoints`
   - Implement read APIs used by all clients.
   - Return seeded data until real sync lands.
   - Add API tests for ranking, period filtering, and privacy filtering.

6. `feat: build web leaderboard and profile views`
   - Build the first web experience inspired by commit-history.com.
   - Add homepage leaderboard, profile page, settings, and empty states.

7. `feat: build ios app shell with score and leaderboard`
   - Add SwiftUI tab structure.
   - Show Today, Leaderboard, Profile, Sync, and Settings views from the shared
     API.
   - Add pairing flow and secure token storage.

8. `feat: build android app shell with score and leaderboard`
   - Add Compose navigation and tab structure.
   - Show Today, Leaderboard, Profile, Sync, and Settings views from the shared
     API.
   - Add pairing flow and encrypted token storage.

9. `feat: add ios HealthKit distance sync`
   - Request HealthKit permissions.
   - Read walking/running distance and workout distance.
   - Preview daily summaries before upload.
   - Add manual sync.

10. `feat: add android Health Connect distance sync`
    - Check Health Connect availability.
    - Request required permissions.
    - Read aggregate walking/running distance and exercise session distance.
    - Add manual sync.

11. `feat: ingest mobile distance summaries`
    - Add mobile-authenticated ingestion endpoint.
    - Validate payloads and source hashes.
    - Upsert daily summaries idempotently.
    - Record sync runs.

12. `feat: add profile charts and sync history to all clients`
    - Add score, commits, and kilometers history to web, iOS, and Android.
    - Show sync status and recent errors consistently.

13. `feat: add privacy controls and delete data flow`
    - Add public leaderboard opt-in.
    - Add device revocation.
    - Add delete-all data flow and clear user-facing copy.

14. `chore: prepare vercel and mobile beta launch`
    - Configure Vercel project and domain checklist for `paceandpush.com`.
    - Add TestFlight and internal Android testing docs.
    - Add privacy policy and health permission rationale.
    - Add launch smoke-test checklist.

## PoC Acceptance Criteria

- A user can sign in with GitHub on the web.
- A user can pair iOS and Android apps to the same account.
- The mobile apps show score, leaderboard, profile, settings, and sync state.
- iOS can read native HealthKit distance and upload daily summaries.
- Android can read native Health Connect distance and upload daily summaries.
- The web and mobile clients show the same leaderboard and profile data.
- Public leaderboard participation is opt-in.
- The project deploys to Vercel and is ready to attach `paceandpush.com`.
