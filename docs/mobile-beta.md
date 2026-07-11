# Mobile Beta Notes

The native companion apps should launch with the same basic information as the
website: current score, leaderboard, public profile, sync state, and settings.
Health-data sync is launch-ready only for a platform after permission request,
secure token storage, daily-total upload, and sync-run reporting are wired in
that native app.

## Native Onboarding Flow

Target flow for a platform that ships health-data sync:

1. Open the native app.
2. Connect GitHub from the app through backend-mediated mobile OAuth.
3. Store the returned Pace & Push mobile bearer token in the platform
   keychain/keystore.
4. Request read-only Apple Health or Health Connect access.
5. Send daily running distance totals to `/api/mobile/distance-days` while the
   account remains private.
6. After the first sync, show the exact public summary and let the user either
   keep it private or grant current versioned publication consent. Keep dated
   activity history as a separate default-off choice.
7. Show the main app tabs only after the user has made that publication decision.

The website-generated pairing code remains useful as a fallback and manual test
path, but it should not be the primary iOS onboarding path.

## Web App Download Surface

- The web homepage and public profiles should show iPhone and Android download
  actions.
- The download actions should open QR/link modals backed by configured store or
  beta URLs.
- Direct-link Settings can show connected devices, generate fallback pairing
  codes, and revoke devices.
- The fallback pairing code flow should be visible only after GitHub sign-in.

## iOS

- Start GitHub sign-in with `ASWebAuthenticationSession`.
- Redirect back through the `pacepush://auth/callback` URL scheme.
- Exchange the native auth code for a mobile device bearer token.
- Store the bearer token in Keychain.
- Gate the tab UI behind GitHub connection, HealthKit permission, first sync,
  and a current private-or-public publication decision.
- Read HealthKit running workouts.
- Request read-only HealthKit workout access.
- Aggregate running distance by UTC day.
- Upload daily totals, not raw workouts.
- Always establish the mobile device privately; never reuse a stale local
  public preference during authentication.

## Android

- Current status: internal-test client. The app pairs with the production API,
  loads `/api/mobile/me`, `/api/mobile/me/profile`, and `/api/leaderboard`,
  requests Health Connect permission, and uploads daily totals plus sync-run
  status.
- Android Settings requires current server consent before displaying a public
  state and provides explicit publish, separate dated-history, and withdrawal
  actions.
- Before public Google Play distribution, complete the real-device checklist
  with one Android Health Connect device, confirm the GitHub Actions Android
  build is green on `main`, and complete Play Console Health Connect review.
- Android sync reads Health Connect running exercise sessions, aggregates
  `DistanceRecord` distance inside those sessions by UTC day, and uploads daily
  totals, not raw records.

## Date Bucketing

Pace & Push scores use UTC calendar days. Native clients should assign each
running workout/session to the UTC date of its start time before uploading daily
distance totals. This keeps mobile uploads aligned with GitHub contribution
queries and backend week/month/year period boundaries.

## Beta Boundaries

- No social feeds.
- No raw activity maps, workouts, routes, or health samples.
- No paid plans.
- No background sync until foreground sync is trusted on real devices.
