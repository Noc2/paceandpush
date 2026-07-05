# Pace & Push Android

Native Kotlin client for Pace & Push.

The PoC app shell will include Today, Leaderboard, Profile, Sync, and Settings
tabs, plus Health Connect running distance sync.

Health Connect sync reads running exercise sessions, aggregates `DistanceRecord`
distance inside those sessions, and shapes them for the web API's
`/api/mobile/distance-days` endpoint. The app declares read-only running
exercise and distance data access for the PoC.
