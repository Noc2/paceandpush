# Mobile Beta Notes

The native companion apps should launch with the same basic information as the
website: current score, leaderboard, public profile, sync state, and settings.

## Pairing Flow

1. Sign in on the web app with GitHub.
2. Request a pairing code from `/api/mobile/pairing-codes`.
3. Exchange the code from the native app at `/api/mobile/devices`.
4. Store the returned bearer token in the platform keychain/keystore.
5. Send daily distance totals to `/api/mobile/distance-days`.

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
