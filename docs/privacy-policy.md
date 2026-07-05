# Privacy Policy Draft

Pace & Push is a proof-of-concept leaderboard for developers who want to compare
monthly coding activity and running distance.

## Data We Collect

- GitHub identity: GitHub id, username, display name, and avatar URL.
- GitHub activity summaries: daily commit counts used for scoring.
- Distance summaries: daily running distance totals from HealthKit or Health
  Connect.
- Device sync metadata: platform, device label, sync status, and timestamps.

## Data We Do Not Collect In The PoC

- Raw workouts.
- GPS routes.
- Step-by-step health samples.
- Private repository source code.
- Payment information.

## How Data Is Used

Data is used to calculate monthly leaderboard scores, show profile history, and
debug sync reliability. The PoC uses daily running totals instead of raw
activity data.

## Controls

Users can export account/profile data through `/api/me/privacy-export`. Account
deletion is represented by `DELETE /api/me/delete` in the PoC and should become
a durable deletion workflow before public launch.

## Contact

For launch, replace this section with the production support email for
`paceandpush.com`.
