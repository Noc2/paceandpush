# Pace & Push Android

Native Kotlin client for Pace & Push.

The current PoC app shell includes Today, Leaderboard, Profile, Sync, and
Settings tabs, plus pairing-code exchange with the web API.

Health Connect sync scaffolding exists in `HealthConnectDistanceSync.kt`: it can
read running exercise sessions, aggregate `DistanceRecord` distance inside those
sessions, and shape daily totals for `/api/mobile/distance-days`. The Android
UI does not yet request Health Connect permission at runtime or upload
`/api/mobile/distance-days` and `/api/mobile/sync-runs` payloads, so Android is
pairing/shell-only until that wiring is finished.
