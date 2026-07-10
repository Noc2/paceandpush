# Store Screenshot Checklist

Capture screenshots from real product states. Do not use mock data for final
store submission screenshots unless the store metadata explicitly labels them as
demo content.

## iOS

- Onboarding with GitHub connection.
- Apple Health permission rationale.
- Health permission granted state.
- First sync success with daily aggregate distance.
- Leaderboard with public users.
- Public profile.
- Settings with sign-out, device revocation, export, and delete.
- Zero-distance recovery hint.

### App Store Upload Set

The deterministic XCUITest capture uses English (U.S.), a fixed 09:41 status
bar, and either the visible Try Demo state or a generic `sample-builder`
identity. It does not use a real GitHub account or health information.

Run `testCaptureAppStoreScreenshots` on an iPhone 13 Pro Max simulator to
produce Apple's accepted 1284 x 2778 pixel size. Export the retained
attachments from the `.xcresult` bundle with `xcresulttool`, then stage the
upload files under `.build/app-store-screenshots/upload/`.

Recommended upload order:

1. `01-profile.png`
2. `02-leaderboard.png`
3. `03-onboarding.png`
4. `04-settings.png`
5. `05-public-profile.png`

The first three lead with the core score, comparison, and setup experience,
which are the strongest product-page and search-result images. Screenshot
artifacts stay under `.build/` and are not committed.

## Android Internal

- Pairing/settings state.
- Health Connect unavailable state.
- Health Connect permission rationale.
- Permission denied and retry state.
- First successful sync on a physical device.
- Leaderboard/profile loaded from the real API.
- Token revocation or disconnected state.

## Web

- Homepage download actions with configured App Store/TestFlight and Google Play
  or internal testing links.
- Public leaderboard.
- Public profile/embed card.
- Settings mobile-pairing panel.
- Privacy and Impressum footer links.

## Review Evidence

- Screenshot date: 2026-07-10
- Commit SHA: `cb77720` plus the local screenshot-capture changes
- Web deployment URL: `https://paceandpush.com`
- Native build number: App Store Connect version 0.1, build 21
- Device and OS: iPhone 13 Pro Max simulator, iOS 26.5
- Demo mode state: visible Try Demo data plus generic `sample-builder` profile
- Tester account: none; no real account or health data used
