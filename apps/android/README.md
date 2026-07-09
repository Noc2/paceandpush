# Pace & Push Android

Native Kotlin client for Pace & Push.

The current internal-test client includes Board, Profile, and Settings tabs,
pairing-code exchange with the web API from Settings, authenticated reads from
`/api/mobile/me` and `/api/mobile/me/profile`, public leaderboard reads from
`/api/leaderboard`, Health Connect permission UX, foreground distance upload,
sync-run reporting, and an in-app sign-out path that revokes the paired device.

Health Connect sync reads running exercise sessions, aggregates
`DistanceRecord` distance inside those sessions by UTC day, and uploads daily
totals to `/api/mobile/distance-days`. It records sync status through
`/api/mobile/sync-runs`.

Android should remain on Google Play internal testing until the physical-device
checklist in `docs/launch/real-device-beta-checklist.md` is complete and the
Android CI build is green on `main`.
