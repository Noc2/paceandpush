# iOS Privacy Report Evidence

- Archive evidence date: July 7, 2026
- Last verified: July 10, 2026

This evidence file records the local archive used to verify that the Pace & Push
iOS app bundles `PrivacyInfo.xcprivacy` and that the manifest matches the
production privacy policy and App Store privacy-label plan.

## Apple Guidance Used

- [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Describing data use in privacy manifests](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests)
- [Describing use of required reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
- [App privacy details on the App Store](https://developer.apple.com/app-store/app-privacy-details/)

Apple documents the generated privacy report as an Xcode Organizer action after
archiving: choose Product > Archive, control-click the archive in Organizer,
choose Generate Privacy Report, then save the report. On this machine,
`xcrun --find privacyreport` returned no developer tool and `xcodebuild -help`
does not list a privacy-report export flag, so the official Xcode report should
be exported from Organizer for the final App Review upload package.

## Local Archive

Command:

```sh
xcodebuild -project apps/ios/PacePush.xcodeproj \
  -scheme PacePush \
  -configuration Release \
  -destination generic/platform=iOS \
  -derivedDataPath .build/app-review/DerivedData \
  -archivePath .build/app-review/PacePush.xcarchive \
  archive \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY=
```

Result: `ARCHIVE SUCCEEDED`

Archive metadata:

- Xcode: `Xcode 26.6`, build `17F113`
- Archive path: `.build/app-review/PacePush.xcarchive`
- Bundle identifier: `com.paceandpush.app`
- Version: `0.1`
- Build: `1`
- Architecture: `arm64`
- Signing identity: empty because this was an unsigned local evidence archive

Bundled privacy manifest:

```text
.build/app-review/PacePush.xcarchive/Products/Applications/PacePush.app/PrivacyInfo.xcprivacy
```

The archive log included:

```text
CopyPlistFile .../PacePush.app/PrivacyInfo.xcprivacy .../apps/ios/PrivacyInfo.xcprivacy
```

## Declared Collected Data

All collected data entries are declared as linked to the user, not used for
tracking, and used for `NSPrivacyCollectedDataTypePurposeAppFunctionality`.

| Apple data type | Pace & Push data covered |
| --- | --- |
| `NSPrivacyCollectedDataTypeUserID` | GitHub id, username, login handle, and account identifiers used for sign-in and scoring. |
| `NSPrivacyCollectedDataTypeName` | GitHub display name shown in profile and leaderboard surfaces. |
| `NSPrivacyCollectedDataTypeOtherUserContent` | GitHub contribution and commit-count summaries used for scoring. |
| `NSPrivacyCollectedDataTypeDeviceID` | Mobile device record and device-token metadata used for pairing, sync authorization, and revocation. |
| `NSPrivacyCollectedDataTypeProductInteraction` | Account settings such as leaderboard visibility, units, and selected score period. |
| `NSPrivacyCollectedDataTypeFitness` | Daily aggregate HealthKit running-distance totals. |
| `NSPrivacyCollectedDataTypeOtherDiagnosticData` | Sync timestamps, sync status, and sync error summaries used to operate and troubleshoot the service. |
| `NSPrivacyCollectedDataTypeOtherDataTypes` | OAuth scope/token metadata, avatar URL, score snapshot metadata, and other service-operation fields that do not fit a narrower Apple category. |

The manifest declares no tracking and no tracking domains:

```text
NSPrivacyTracking = false
NSPrivacyTrackingDomains = []
```

## Required-Reason APIs

The native app uses `UserDefaults` only for app-local preferences and state such
as units, active score period, HealthKit authorization state, first-sync
timestamp, public-leaderboard preference, and historical sync bookkeeping.

Declared required-reason API:

| API category | Reason | Use |
| --- | --- | --- |
| `NSPrivacyAccessedAPICategoryUserDefaults` | `CA92.1` | Read and write information that is only accessible to the Pace & Push app itself. |

## App Review Follow-Up

Before the final App Store submission, open the successful archive in Xcode
Organizer, choose Generate Privacy Report, save the official report PDF beside
this evidence file, and confirm its nutrition-label summary matches the table
above.

## July 10 Verification Status

The repository privacy inputs remain valid:

```text
apps/ios/PrivacyInfo.xcprivacy: OK
apps/ios/Info.plist: OK
apps/ios/PacePush.entitlements: OK
```

`PrivacyInfo.xcprivacy` remains included in the app target's Resources build
phase. The existing local archives contain the manifest at the app-bundle root,
and the archived binary-plist content normalizes to the current source
manifest.

An official final Organizer report could not be generated on July 10:

- `security find-identity -v -p codesigning` reported `0 valid identities
  found`.
- `~/Library/Developer/Xcode/Archives` does not contain an Organizer archive.
- The available repository-local archives are unsigned `0.1 (1)` evidence
  archives and are not the current TestFlight or final production candidate.
- Xcode provides no `privacyreport` command-line tool or `xcodebuild` export
  flag for the official report.

The final PDF must therefore be generated from the exact signed archive that
will be uploaded. Record its version, build number, Git SHA, archive date,
signing team, archive path, and report path here. Do not rearchive between
generating the report and uploading the build.

## App Store Connect Questionnaire Verification

App Store Connect was inspected read-only on July 10. The privacy-policy URL is
`https://paceandpush.com/privacy`, tracking is not declared, and the product-page
preview lists data linked to the user. The eight selected data types match this
manifest and the table above:

- Name
- Fitness
- Other User Content
- User ID
- Device ID
- Product Interaction
- Other Diagnostic Data
- Other Data Types

Each is currently declared for app functionality and linked to the user. App
Store Connect still showed an enabled **Publish** button, so the saved privacy
answers were not published during this verification. Publish them only after
comparing the exact signed archive's Organizer report with this file and the
production privacy policy.
