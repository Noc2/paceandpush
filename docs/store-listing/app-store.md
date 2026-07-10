# App Store Listing Draft

## App Name

Pace & Push

## Subtitle

Run more. Ship more.

## Promotional Text

Turn GitHub contributions and running distance into one balanced score—and see
how you stack up against other builders who train.

## Description

Pace & Push combines your GitHub contribution activity with running distance to
create one balanced score for builders who train.

Connect GitHub, grant read-only Apple Health access, and see how daily commit
counts and running distance shape your progress across weeks, months, and
years.

FEATURES

- View your balanced score, commit count, running distance, and leaderboard
  rank.
- Explore week, month, and year progress with visual charts.
- Compare Balanced, Commits, and Running leaderboards.
- Browse public developer profiles.
- Choose kilometers or miles and control leaderboard visibility.
- Export your data, disconnect GitHub, or delete your account in Settings.

PRIVACY

The app uploads only daily aggregate running distance totals. It does not upload
raw workouts, GPS routes, maps, heart-rate samples, or step-by-step HealthKit
records. Apple Health is read only when you sync while the app is open.

Pace & Push is not a medical, diagnostic, coaching, betting, or prize app.

## Keywords

```text
running,developer,coding,commit,leaderboard,fitness,workout,distance,habit,productivity,score
```

The keyword string is 93 ASCII bytes. It intentionally avoids the app name,
company name, categories, and third-party trademarks.

## URLs

- Support URL: `https://paceandpush.com/settings`
- Marketing URL: `https://paceandpush.com`
- Privacy Policy URL: `https://paceandpush.com/privacy`

## Category And Copyright

- Primary category: Health & Fitness
- Secondary category: Developer Tools
- Copyright: `2026 Hawig Ventures UG (haftungsbeschränkt)`

## Review Notes

Use `docs/launch/app-review-notes-ios.md` for the Try Demo review path,
GitHub-specific login rationale, HealthKit explanation, and
disconnect/revocation path.

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
