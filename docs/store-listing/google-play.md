# Google Play Listing Draft

Android is internal-testing only until the real API client, Health Connect
permission flow, upload flow, launcher assets, and repeatable build path are
verified on a physical device.

## App Name

Pace & Push

## Short Description

A GitHub and running leaderboard for builders.

## Full Description

Pace & Push combines GitHub contribution summaries with daily aggregate running
distance to create a lightweight leaderboard for builders who train.

The Android app uses Health Connect only for running exercise and distance data.
It uploads daily aggregate running distance totals and does not upload raw
workouts, GPS routes, maps, heart-rate samples, or step-by-step Health Connect
records.

Users can revoke Health Connect permissions, sign out of GitHub, revoke
connected devices, export data, and delete the account.

Pace & Push is not a medical, diagnostic, coaching, betting, or prize app.

## Health Connect Declaration

Requested data:

- Exercise sessions: identify running sessions.
- Distance: calculate daily aggregate running distance within running sessions.

Purpose:

- App functionality only: combine running distance with GitHub contribution
  summaries for the user's score and leaderboard/profile surfaces.

Data handling:

- Upload daily aggregate running distance totals only.
- Do not upload raw workouts, raw health samples, GPS routes, or maps.
- Keep Health Connect access revocable through Android settings.
- Keep production API traffic over HTTPS.

## Data Safety Draft

Declare collection of:

- Personal identifiers: GitHub id, login, username, display name, account id.
- App activity/content: GitHub contribution and commit-count summaries.
- Health and fitness: daily aggregate running distance totals.
- App info/performance or diagnostics: sync status, timestamps, and error
  summaries used to operate the service.
- App interactions/settings: leaderboard visibility, units, selected period,
  device metadata, and revocation metadata.

No advertising, no sale of data, and no tracking across apps or sites.

## Release Contact

- Support: hawigxyz@proton.me
- Privacy: hawigxyz@proton.me

## Public Release Blockers

- Real Android API reads for profile and leaderboard.
- Health Connect runtime permission request and denial/retry states.
- Successful `/api/mobile/distance-days` and `/api/mobile/sync-runs` upload on
  a physical device.
- Android launcher/adaptive icon assets.
- Repeatable CI or documented local Gradle build path.
