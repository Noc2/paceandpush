# iOS App Review Notes

Use these notes in App Store Connect for the first Pace & Push iOS submission.

## Notes For Review

Pace & Push is a GitHub-specific client. GitHub sign-in is required because the
core product reads the user's GitHub contribution summaries, combines those
commit counts with daily running distance totals, and builds the Pace & Push
score. Without access to the user's GitHub contribution content, the app cannot
calculate the coding side of the score or present the core profile and
leaderboard experience.

GitHub login is not used only for basic profile import, sharing, inviting
friends, or generic account creation. It is the account for the third-party
service whose contribution content the app is built around.

The in-app GitHub disconnect path is available from:

Settings tab > Sync > GitHub > Disconnect GitHub

When a user confirms that action, the iOS app calls
`DELETE /api/mobile/me/github/disconnect`. The server verifies the current
mobile device token, clears the stored GitHub OAuth access token material and
scopes, deletes commit-derived scoring data and score snapshots, recomputes
affected leaderboard periods, revokes the current mobile device token, and then
the iOS app clears its local Keychain token and sync markers. This disables
future data access between Pace & Push and GitHub from inside the app.

Reviewers can test the flow with a connected account:

1. Open Pace & Push.
2. Sign in with GitHub.
3. Open Settings.
4. Confirm that "Disconnect GitHub" is visible in the Sync section.
5. Tap "Disconnect GitHub" and confirm the dialog.
6. Confirm the app returns to the setup flow and no longer allows score sync
   until GitHub is connected again.

Apple Health access is requested separately and remains controlled by the
user's iOS Health permissions. Pace & Push uploads only daily running distance
totals, not raw workouts or routes.

## Guideline Rationale

Apple App Review Guideline 4.8 allows the single-login posture for an app that
is a client for a specific third-party service where users must sign in to
access their content. Pace & Push uses GitHub specifically to access the user's
GitHub contribution content.

Apple App Review Guideline 5.1.1(v) requires account sign-in to be directly
relevant to core functionality and requires an in-app mechanism to revoke
social-network credentials and disable data access. Pace & Push satisfies this
through Settings > Sync > GitHub > Disconnect GitHub.

Sources:

- Apple App Review Guidelines:
  https://developer.apple.com/app-store/review/guidelines/
