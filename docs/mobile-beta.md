# Mobile Beta Notes

The native companion apps should launch with the same basic information as the
website: current score, leaderboard, public profile, sync state, and settings.

## Pairing Flow

1. Sign in on the web app with GitHub.
2. Open Settings and request a short-lived pairing code from the companion-app
   section.
3. Exchange the code from the native app at `/api/mobile/devices`.
4. Store the returned bearer token in the platform keychain/keystore.
5. Send daily distance totals to `/api/mobile/distance-days`.

## Web Companion App Surface

- The web homepage should list the iOS and Android companion apps as the distance
  sync path.
- Settings should show connected devices, generate pairing codes, and revoke
  devices.
- The pairing code flow should be visible only after GitHub sign-in.

## iOS

- Read HealthKit `distanceWalkingRunning`.
- Request read-only HealthKit access.
- Aggregate distance by UTC day.
- Upload daily totals, not raw workouts.

## Android

- Use Health Connect `DistanceRecord` aggregate reads.
- Request read-only distance access.
- Provide the Health Connect permission rationale activity.
- Upload daily totals, not raw records.

## Beta Boundaries

- No social feeds.
- No raw activity maps, workouts, routes, or health samples.
- No paid plans.
- No background sync until foreground sync is trusted on real devices.
