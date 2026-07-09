# App Store Listing Draft

## App Name

Pace & Push

## Subtitle

Run more. Ship more.

## Promotional Text

Turn daily GitHub activity and running distance into a lightweight leaderboard
for builders who train.

## Description

Pace & Push is a GitHub-specific fitness companion for runners who ship code.
Connect GitHub, grant Apple Health read access, and Pace & Push combines daily
commit summaries with daily aggregate running distance to build a public score.

The app uploads only daily aggregate running distance totals. It does not upload
raw workouts, GPS routes, maps, heart-rate samples, or step-by-step HealthKit
records.

Use Pace & Push to:

- See your current week, month, and year score.
- Compare with other public leaderboard users.
- Sync running distance from Apple Health.
- Sign out of GitHub, revoke devices, export data, or delete the account from
  Settings.

Pace & Push is not a medical, diagnostic, coaching, betting, or prize app.

## Review Notes

Use `docs/launch/app-review-notes-ios.md` for the GitHub-specific login
rationale, HealthKit explanation, and disconnect/revocation path.

## Privacy Labels

Declare data linked to the user and used for app functionality:

- Contact/info/account identifiers: GitHub id, login, username, display name,
  avatar URL, and service account id.
- User content/activity: GitHub contribution and commit-count summaries visible
  to the user's GitHub token.
- Fitness: daily aggregate running distance totals from Apple Health.
- Identifiers/diagnostics/product interaction: device pairing metadata, sync
  status, sync timestamps, error summaries, leaderboard settings, unit
  preference, selected period, score snapshots, and revocation metadata.

Do not declare tracking or advertising. Do not declare native app analytics
unless an analytics SDK or provider is added to the iOS app; the website's
Simple Analytics script is covered in `/privacy` and does not change the native
App Store label by itself.

## Release Contact

- Support: hawigxyz@proton.me
- Privacy: hawigxyz@proton.me

## Claims To Avoid

- Medical, diagnostic, therapy, injury-prevention, or health-improvement claims.
- Prize, gambling, financial, or compensation claims.
- Claims that private repository code is collected.
- Claims that raw workouts, GPS routes, or HealthKit samples are uploaded.
