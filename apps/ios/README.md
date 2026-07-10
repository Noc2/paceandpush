# Pace & Push iOS

Native SwiftUI client for Pace & Push.

## Run locally

1. Open `PacePush.xcodeproj` in Xcode.
2. Select the `PacePush` scheme.
3. Pick an iPhone simulator.
4. Press Run.

The simulator build is intended for seeing the current app shell. HealthKit data
access requires a real iPhone and Apple Developer signing with HealthKit enabled.

## Native onboarding

The app gates the Profile, Board, and Settings tabs until setup is complete, or
until the local Try Demo path is started:

1. Connect GitHub through the `ASWebAuthenticationSession` flow.
2. Return through the `pacepush://auth/callback` URL scheme.
3. Store the returned mobile device token in Keychain.
4. Request read-only HealthKit workout access.
5. Run a foreground running-distance sync.

Try Demo opens the same tab shell with local sample data. It does not create a
server account, request HealthKit permissions, or upload data.

HealthKit sync reads running workouts, groups running distance by day, and
shapes payloads for the web API's `/api/mobile/distance-days` endpoint. It reads
the current UTC calendar year when preparing daily totals and intentionally
syncs daily totals instead of raw workouts.
