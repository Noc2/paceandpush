# Pace & Push Android

Native Kotlin client for Pace & Push.

The PoC app shell will include Today, Leaderboard, Profile, Sync, and Settings
tabs, plus Health Connect distance sync.

Health Connect sync uses daily aggregate distance buckets from `DistanceRecord`
and shapes them for the web API's `/api/mobile/distance-days` endpoint. The app
declares read-only distance access for the PoC.
