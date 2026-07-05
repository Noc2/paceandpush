# Mobile Beta Notes

The native companion apps should launch with the same basic information as the
website: current score, leaderboard, public profile, sync state, and settings.

## Native Onboarding Flow

1. Open the native app.
2. Connect GitHub from the app through backend-mediated mobile OAuth.
3. Store the returned Pace & Push mobile bearer token in the platform
   keychain/keystore.
4. Request read-only Apple Health or Health Connect access.
5. Run the first foreground sync before showing the main app tabs.
6. Send daily running distance totals to `/api/mobile/distance-days`.

The website-generated pairing code remains useful as a fallback and manual test
path, but it should not be the primary iOS onboarding path.

## Web Companion App Surface

- The web homepage should list the iOS and Android companion apps as the running
  distance sync path.
- Settings should show connected devices, generate pairing codes, and revoke
  devices.
- The pairing code flow should be visible only after GitHub sign-in.

## iOS

- Start GitHub sign-in with `ASWebAuthenticationSession`.
- Redirect back through the `pacepush://auth/callback` URL scheme.
- Exchange the native auth code for a mobile device bearer token.
- Store the bearer token in Keychain.
- Gate the tab UI behind GitHub connection, HealthKit permission, and first sync.
- Read HealthKit running workouts.
- Request read-only HealthKit workout access.
- Aggregate running distance by UTC day.
- Upload daily totals, not raw workouts.

## Android

- Read Health Connect running exercise sessions and aggregate `DistanceRecord`
  distance inside those sessions.
- Request read-only exercise-session and distance access.
- Provide the Health Connect permission rationale activity.
- Upload daily totals, not raw records.

## Beta Boundaries

- No social feeds.
- No raw activity maps, workouts, routes, or health samples.
- No paid plans.
- No background sync until foreground sync is trusted on real devices.
