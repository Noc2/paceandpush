# Pace & Push iOS

Native SwiftUI client for Pace & Push.

The PoC app shell will include Today, Leaderboard, Profile, Sync, and Settings
tabs, plus HealthKit distance sync.

HealthKit sync reads `distanceWalkingRunning`, groups distance by day, and shapes
payloads for the web API's `/api/mobile/distance-days` endpoint. The initial
implementation intentionally syncs daily totals instead of raw workouts.
