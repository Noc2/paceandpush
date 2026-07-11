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
`/api/mobile/sync-runs`. Health Connect authorization and the permission
rationale both explain that these aggregates initially sync to the user's
private account and that public sharing is a separate choice.

Settings parses publication state as public only when the server returns the
current `public-health-v1` consent and timestamp. Users can explicitly publish
their exact active-period kilometers together with their public profile totals,
separately opt in to dated activity history, or make the profile private again.
Publication changes are applied locally only after the authenticated settings
API confirms the requested authoritative state.

Android should remain on Google Play internal testing until the physical-device
checklist in `docs/launch/real-device-beta-checklist.md` is complete and the
Android CI build is green on `main`.
