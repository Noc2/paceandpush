# @paceandpush/api-contracts

Shared contracts for the web API and the native clients.

The TypeScript source is the implementation-facing shape. The checked OpenAPI
file gives iOS and Android a stable fixture for model generation or hand-written
model parity checks during the PoC.

Distance-day uploads use UTC calendar dates in `YYYY-MM-DD` format. Native
clients should bucket HealthKit or Health Connect running sessions by the
session start time's UTC date before sending `/api/mobile/distance-days`, so
week/month/year leaderboard periods match the backend scoring calendar.
