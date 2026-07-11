# Google Play Listing Draft

Android is internal-testing only until Health Connect sync and withdrawal,
public-sharing consent, launcher assets, and the repeatable release path are
verified on a physical device and the Play Console declarations are approved.

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

The initial aggregate sync is private. Publishing exact period kilometers,
identity, commit total, derived score, rank, streak, bio, and last-sync time is
a separate optional action with a clear no-account public audience disclosure.
Dated activity history is a separate default-off option, and public sharing can
be withdrawn from Settings.

Users can revoke Health Connect permissions, sign out of GitHub, revoke
connected devices, export data, and delete the account.

Pace & Push is not a medical, diagnostic, coaching, betting, or prize app.

## Health Connect Declaration

Requested data:

- Exercise sessions: identify running sessions.
- Distance: calculate daily aggregate running distance within running sessions.

Purpose:

- App functionality only: combine running distance with GitHub contribution
  summaries for the user's private score and, only after separate explicit
  consent, optional social fitness leaderboard/profile surfaces.

Data handling:

- Upload daily aggregate running distance totals only.
- Sync aggregates privately before offering optional public sharing.
- Require explicit informed consent before public display or social sharing;
  keep dated history as a separate default-off choice.
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

No advertising, no sale of data, no eligibility/insurance/employment use, and
no tracking across apps or sites.

Policy references:

- Health Content and Services:
  https://support.google.com/googleplay/android-developer/answer/16679511
- Android health permissions guidance:
  https://support.google.com/googleplay/android-developer/answer/12991134
- Prominent disclosure and consent:
  https://support.google.com/googleplay/android-developer/answer/11150561

## Release Contact

- Support: hawigxyz@proton.me
- Privacy: hawigxyz@proton.me

## Public Release Blockers

- Successful `/api/mobile/distance-days` and `/api/mobile/sync-runs` upload on
  a physical device.
- Successful private-first sync, versioned publication, separate dated-history
  consent, and withdrawal on a physical device.
- Android launcher/adaptive icon assets.
- Approved Health Apps, Health Connect, and Data safety declarations that match
  the live privacy policy and in-app disclosure.
