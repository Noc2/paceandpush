# iOS App Review Notes

Use these notes in App Store Connect for the first Pace & Push iOS submission.

## Notes For Review

Pace & Push includes a fully local review/demo path. From the first setup
screen, tap **Try Demo** to open the app with sample profile, leaderboard, chart,
and settings data. Demo mode does not require a GitHub account, does not request
Apple Health permissions, does not create a server account, and does not upload
data. Reviewers can leave "Sign-in required" unchecked in Test Information and
use the Notes for Review below.

Demo review steps:

1. Open Pace & Push.
2. Tap "Try Demo".
3. Review the sample Profile chart, Board/leaderboard, and Settings tabs.
4. Tap Exit Demo at the top of any main tab to return to setup.
5. If a real account flow is needed, return to setup and choose Connect GitHub.

Pace & Push is a GitHub-specific client. GitHub sign-in is required because the
core product reads the user's GitHub contribution summaries, combines those
commit counts with daily running distance totals, and builds the Pace & Push
score. Without access to the user's GitHub contribution content, the app cannot
calculate the coding side of the score or present the core profile and
leaderboard experience.

GitHub login is not used only for basic profile import, sharing, inviting
friends, or generic account creation. It is the account for the third-party
service whose contribution content the app is built around.

The in-app GitHub sign-out path is available from:

Settings tab > Sync > GitHub > Sign out

When a user confirms that action, the iOS app calls
`DELETE /api/mobile/me/github/disconnect`. The server verifies the current
mobile device token, clears the stored GitHub OAuth access token material and
scopes, deletes commit-derived scoring data and score snapshots, revokes the
current mobile device token, and recomputes affected leaderboard periods. After
the server confirms those actions, the iOS app clears its local Keychain token
and sync markers. This disables future data access between Pace & Push and GitHub
from inside the app.

If the server cannot confirm disconnection, the app keeps the device credential,
shows an error, and leaves Sign out available so the reviewer can retry.

Reviewers can test the flow with a connected account:

1. Open Pace & Push.
2. Sign in with GitHub.
3. Open Settings.
4. Confirm that "Sign out" is visible in the Sync section.
5. Tap "Sign out" and confirm the dialog.
6. Confirm the app returns to the setup flow and no longer allows score sync
   until GitHub is connected again.

Apple Health access is requested separately and remains controlled by the
user's iOS Health permissions. Before requesting access, onboarding explains
that Pace & Push uploads daily running distance totals and that those totals
contribute to the user's public profile and leaderboard when public scoring is
enabled. Totals are bucketed by UTC calendar day; raw workouts and routes remain
in Apple Health and are not uploaded.

## Guideline Rationale

Apple's review preparation guidance asks developers to provide full app access
with either an active demo account or a fully featured demo mode. Pace & Push
uses the fully featured demo mode for review access so App Review can inspect
the app without creating a GitHub account.

Apple App Review Guideline 4.8 allows the single-login posture for an app that
is a client for a specific third-party service where users must sign in to
access their content. Pace & Push uses GitHub specifically to access the user's
GitHub contribution content.

Apple App Review Guideline 5.1.1(v) requires account sign-in to be directly
relevant to core functionality and requires an in-app mechanism to revoke
social-network credentials and disable data access. Pace & Push satisfies this
through Settings > Sync > GitHub > Sign out.

Sources:

- Apple App Review Guidelines:
  https://developer.apple.com/app-store/review/guidelines/
