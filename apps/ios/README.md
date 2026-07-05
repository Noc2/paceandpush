# Pace & Push iOS

Native SwiftUI client for Pace & Push.

## Run locally

1. Open `PacePush.xcodeproj` in Xcode.
2. Select the `PacePush` scheme.
3. Pick an iPhone simulator.
4. Press Run.

The simulator build is intended for seeing the current app shell. HealthKit data
access requires a real iPhone and Apple Developer signing with HealthKit enabled.

The PoC app shell will include Today, Leaderboard, Profile, Sync, and Settings
tabs, plus HealthKit running distance sync.

HealthKit sync reads running workouts, groups running distance by day, and
shapes payloads for the web API's `/api/mobile/distance-days` endpoint. The
initial implementation intentionally syncs daily totals instead of raw workouts.
