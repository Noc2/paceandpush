import Foundation
import SwiftUI
import XCTest
@testable import PacePush

final class PacePushTests: XCTestCase {
    @MainActor
    func testThemePreferenceDefaultsToSystemAndMapsColorSchemes() {
        let store = PacePushStore(
            keychain: InMemoryKeychain(),
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: InMemoryPreferences(values: [:]),
            apiClientFactory: { _, _ in FakePacePushClient() },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        XCTAssertEqual(store.themePreference, .system)
        XCTAssertNil(store.themePreference.colorScheme)
        XCTAssertNil(BrandThemePreference.system.colorScheme)
        XCTAssertEqual(BrandThemePreference.light.colorScheme, .light)
        XCTAssertEqual(BrandThemePreference.dark.colorScheme, .dark)
    }

    @MainActor
    func testThemePreferencePersistsLightAndDarkSelections() {
        let preferences = InMemoryPreferences(values: [:])
        let store = PacePushStore(
            keychain: InMemoryKeychain(),
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in FakePacePushClient() },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        store.themePreference = .light
        XCTAssertEqual(preferences.string(forKey: "themePreference"), "light")
        let restoredLightStore = PacePushStore(
            keychain: InMemoryKeychain(),
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in FakePacePushClient() },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )
        XCTAssertEqual(restoredLightStore.themePreference, .light)
        XCTAssertEqual(restoredLightStore.themePreference.colorScheme, .light)

        restoredLightStore.themePreference = .dark
        XCTAssertEqual(preferences.string(forKey: "themePreference"), "dark")
        let restoredDarkStore = PacePushStore(
            keychain: InMemoryKeychain(),
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in FakePacePushClient() },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )
        XCTAssertEqual(restoredDarkStore.themePreference, .dark)
        XCTAssertEqual(restoredDarkStore.themePreference.colorScheme, .dark)
    }

    @MainActor
    func testThemePreferenceRestoresStoredSystemAndFallsBackForInvalidValues() {
        let systemStore = PacePushStore(
            keychain: InMemoryKeychain(),
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: InMemoryPreferences(values: ["themePreference": "system"]),
            apiClientFactory: { _, _ in FakePacePushClient() },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )
        XCTAssertEqual(systemStore.themePreference, .system)
        XCTAssertNil(systemStore.themePreference.colorScheme)

        let invalidStore = PacePushStore(
            keychain: InMemoryKeychain(),
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: InMemoryPreferences(values: ["themePreference": "sepia"]),
            apiClientFactory: { _, _ in FakePacePushClient() },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )
        XCTAssertEqual(invalidStore.themePreference, .system)
        XCTAssertNil(invalidStore.themePreference.colorScheme)
    }

    func testDistanceUnitAbbreviations() {
        XCTAssertEqual(DistanceUnits.metric.abbreviation, "km")
        XCTAssertEqual(DistanceUnits.imperial.abbreviation, "mi")
    }

    func testLeaderboardMetricFollowsSelectedBoard() {
        let row = LeaderboardRow(
            rank: 1,
            login: "Noc2",
            displayName: "David Hawig",
            score: 94.2,
            commits: 312,
            kilometers: 86.4,
            streakDays: 11
        )

        XCTAssertEqual(Board.balanced.leaderboardMetricTitle(units: .metric), "Score")
        XCTAssertEqual(Board.commits.leaderboardMetricTitle(units: .metric), "Commits")
        XCTAssertEqual(Board.distance.leaderboardMetricTitle(units: .metric), "Run km")
        XCTAssertEqual(Board.distance.leaderboardMetricTitle(units: .imperial), "Run mi")
        XCTAssertEqual(Board.commits.leaderboardMetric(for: row, units: .metric).value, "312")
        XCTAssertNil(Board.commits.leaderboardMetric(for: row, units: .metric).detail)
        XCTAssertEqual(
            Board.distance.leaderboardMetric(for: row, units: .imperial).value,
            DistanceUnits.imperial.format(row.kilometers)
        )
        XCTAssertNil(Board.distance.leaderboardMetric(for: row, units: .metric).detail)
    }

    func testScorePeriodSupportsDayRangesMonthsAndYears() {
        let date = date("2026-07-06T12:00:00.000Z")
        let week = ScorePeriod(kind: .week, date: date)
        let month = ScorePeriod(kind: .month, date: date)
        let year = ScorePeriod(kind: .year, date: date)

        XCTAssertEqual(week.rawValue, "2026-W28")
        XCTAssertEqual(week.kind, .week)
        XCTAssertEqual(week.shifted(by: -1).rawValue, "2026-W27")
        XCTAssertEqual(month.rawValue, "2026-07")
        XCTAssertEqual(month.label, "July 2026")
        XCTAssertEqual(month.shifted(by: 1).rawValue, "2026-08")
        XCTAssertEqual(year.rawValue, "2026")
        XCTAssertEqual(year.shifted(by: -1).rawValue, "2025")
        XCTAssertNil(ScorePeriod("2026-W54"))
    }

    func testPairingPayloadParserAcceptsCodesCustomSchemeAndWebURLs() throws {
        let productionURL = try XCTUnwrap(URL(string: "https://paceandpush.com"))
        let localURL = try XCTUnwrap(URL(string: "http://localhost:3000"))

        let bare = try XCTUnwrap(PairingPayloadParser.parse(" pp_pair.abc123 ", apiBaseURL: productionURL, callbackScheme: "pacepush"))
        XCTAssertEqual(bare.code, "pp_pair.abc123")
        XCTAssertNil(bare.baseURL)

        let custom = try XCTUnwrap(PairingPayloadParser.parse(
            "pacepush://pair?code=pp_pair.local&baseUrl=http://localhost:3000/mobile/pair",
            apiBaseURL: localURL,
            callbackScheme: "pacepush"
        ))
        XCTAssertEqual(custom.code, "pp_pair.local")
        XCTAssertEqual(custom.baseURL?.absoluteString, "http://localhost:3000")

        let web = try XCTUnwrap(PairingPayloadParser.parse(
            "https://paceandpush.com/mobile/pair?code=pp_pair.web",
            apiBaseURL: productionURL,
            callbackScheme: "pacepush"
        ))
        XCTAssertEqual(web.code, "pp_pair.web")
        XCTAssertEqual(web.baseURL?.absoluteString, "https://paceandpush.com")
    }

    func testPairingPayloadParserRejectsUnknownWebHosts() {
        XCTAssertNil(PairingPayloadParser.parse(
            "https://evil.example/mobile/pair?code=pp_pair.bad",
            apiBaseURL: URL(string: "https://paceandpush.com"),
            callbackScheme: "pacepush"
        ))
    }

    func testMobileAuthPKCEGeneratesVerifierAndChallenge() throws {
        let pkce = try MobileAuthPKCE.generate()

        XCTAssertEqual(pkce.verifier.count, 43)
        XCTAssertEqual(pkce.challenge.count, 43)
        XCTAssertNotEqual(pkce.verifier, pkce.challenge)
        XCTAssertNil(pkce.verifier.range(of: #"[^A-Za-z0-9_-]"#, options: .regularExpression))
        XCTAssertNil(pkce.challenge.range(of: #"[^A-Za-z0-9_-]"#, options: .regularExpression))
    }

    func testRunningDistanceAggregatorBucketsByUTCDayAndSkipsZeroMeters() {
        let days = RunningDistanceAggregator.distanceDays(from: [
            RunningDistanceSample(startDate: date("2026-07-01T23:30:00.000Z"), meters: 500),
            RunningDistanceSample(startDate: date("2026-07-02T00:15:00.000Z"), meters: 750),
            RunningDistanceSample(startDate: date("2026-07-02T07:00:00.000Z"), meters: 1250.4),
            RunningDistanceSample(startDate: date("2026-07-02T08:00:00.000Z"), meters: 0),
        ])

        XCTAssertEqual(days.map(\.date), ["2026-07-01", "2026-07-02"])
        XCTAssertEqual(days[0].meters, 500)
        XCTAssertEqual(days[0].sourceHash, "healthkit-ios-running-2026-07-01-500")
        XCTAssertEqual(days[1].meters, 2000.4, accuracy: 0.001)
        XCTAssertEqual(days[1].sourceHash, "healthkit-ios-running-2026-07-02-2000")
    }

    func testAPIClientAddsBearerTokenAndDecodesMobileUser() async throws {
        let loader = RecordingDataLoader(json: Self.meJSON)
        let client = PacePushAPIClient(baseURL: try XCTUnwrap(URL(string: "https://example.test")), token: "token-123", dataLoader: loader)

        let me = try await client.fetchMe(period: "2026-W27")

        XCTAssertEqual(me.login, "noc2")
        XCTAssertEqual(loader.requests.first?.url?.path, "/api/mobile/me")
        XCTAssertEqual(queryValue("period", in: loader.requests.first?.url), "2026-W27")
        XCTAssertNotNil(queryValue("_appRefresh", in: loader.requests.first?.url))
        XCTAssertEqual(loader.requests.first?.cachePolicy, .reloadIgnoringLocalAndRemoteCacheData)
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "cache-control"), "no-cache")
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "accept"), "application/json")
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "authorization"), "Bearer token-123")
    }

    func testAPIClientAddsPKCEChallengeToMobileGitHubStartURL() throws {
        let client = PacePushAPIClient(baseURL: try XCTUnwrap(URL(string: "https://example.test")), token: nil)

        let url = try client.mobileGitHubStartURL(
            platform: "ios",
            label: "Test iPhone",
            callbackScheme: "pacepush",
            codeChallenge: "challenge-123"
        )

        XCTAssertEqual(url.path, "/api/mobile/auth/github/start")
        XCTAssertEqual(queryValue("platform", in: url), "ios")
        XCTAssertEqual(queryValue("label", in: url), "Test iPhone")
        XCTAssertEqual(queryValue("callbackScheme", in: url), "pacepush")
        XCTAssertEqual(queryValue("codeChallenge", in: url), "challenge-123")
    }

    func testAPIClientTurnsUnauthorizedStatusIntoTypedError() async throws {
        let loader = RecordingDataLoader(json: #"{"error":"unauthorized"}"#, statusCode: 401)
        let client = PacePushAPIClient(baseURL: try XCTUnwrap(URL(string: "https://example.test")), token: "token-123", dataLoader: loader)

        do {
            let _: MeResponse = try await client.fetchMe(period: "2026-07")
            XCTFail("Expected unauthorized error")
        } catch PacePushAPIError.unauthorized {
            XCTAssertEqual(loader.requests.first?.url?.path, "/api/mobile/me")
        }
    }

    func testAPIClientDecodesServerErrorMessage() async throws {
        let loader = RecordingDataLoader(json: #"{"error":"server said no"}"#, statusCode: 422)
        let client = PacePushAPIClient(baseURL: try XCTUnwrap(URL(string: "https://example.test")), token: nil, dataLoader: loader)

        do {
            let _: LeaderboardResponse = try await client.fetchLeaderboard(board: .distance, period: "2026")
            XCTFail("Expected server error")
        } catch PacePushAPIError.server(let message) {
            XCTAssertEqual(message, "server said no")
            XCTAssertEqual(loader.requests.first?.url?.path, "/api/leaderboard")
            XCTAssertEqual(queryValue("board", in: loader.requests.first?.url), "distance")
            XCTAssertEqual(queryValue("period", in: loader.requests.first?.url), "2026")
        }
    }

    func testAPIClientAddsPeriodToMobileProfileRequest() async throws {
        let loader = RecordingDataLoader(json: """
        {
          "login": "noc2",
          "displayName": "David",
          "bio": null,
          "score": {
            "period": "2026-07",
            "score": 42.5,
            "rank": 1,
            "commits": 100,
            "kilometers": 25.5,
            "lastSyncAt": null
          },
          "history": []
        }
        """)
        let client = PacePushAPIClient(baseURL: try XCTUnwrap(URL(string: "https://example.test")), token: "token-123", dataLoader: loader)

        let profile = try await client.fetchProfile(period: "2026-07")

        XCTAssertEqual(profile.login, "noc2")
        XCTAssertEqual(loader.requests.first?.url?.path, "/api/mobile/me/profile")
        XCTAssertEqual(queryValue("period", in: loader.requests.first?.url), "2026-07")
        XCTAssertNotNil(queryValue("_appRefresh", in: loader.requests.first?.url))
        XCTAssertEqual(loader.requests.first?.cachePolicy, .reloadIgnoringLocalAndRemoteCacheData)
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "cache-control"), "no-cache")
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "authorization"), "Bearer token-123")
    }

    func testAPIClientFetchesPublicProfileByLoginAndPeriod() async throws {
        let loader = RecordingDataLoader(json: """
        {
          "login": "octocat",
          "displayName": "Octo Cat",
          "bio": null,
          "score": {
            "period": "2026-07",
            "score": 51.2,
            "rank": 2,
            "commits": 88,
            "kilometers": 12.3,
            "lastSyncAt": null
          },
          "history": []
        }
        """)
        let client = PacePushAPIClient(baseURL: try XCTUnwrap(URL(string: "https://example.test")), token: "token-123", dataLoader: loader)

        let profile = try await client.fetchPublicProfile(login: "octocat", period: "2026-07")

        XCTAssertEqual(profile.login, "octocat")
        XCTAssertEqual(loader.requests.first?.url?.path, "/api/users/octocat")
        XCTAssertEqual(queryValue("period", in: loader.requests.first?.url), "2026-07")
        XCTAssertNil(loader.requests.first?.value(forHTTPHeaderField: "authorization"))
    }

    func testAPIClientDeletesMobileGitHubConnectionWithBearerToken() async throws {
        let loader = RecordingDataLoader(json: """
        {
          "login": "noc2",
          "github": {
            "connected": false,
            "needsReconnect": false,
            "updatedAt": null
          },
          "disconnectedAt": "2026-07-07T12:00:00.000Z"
        }
        """)
        let client = PacePushAPIClient(baseURL: try XCTUnwrap(URL(string: "https://example.test")), token: "token-123", dataLoader: loader)

        let response = try await client.disconnectGitHub()

        XCTAssertEqual(response.login, "noc2")
        XCTAssertEqual(response.disconnectedAt, "2026-07-07T12:00:00.000Z")
        XCTAssertEqual(loader.requests.first?.httpMethod, "DELETE")
        XCTAssertEqual(loader.requests.first?.url?.path, "/api/mobile/me/github/disconnect")
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "accept"), "application/json")
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "authorization"), "Bearer token-123")
    }

    func testAPIClientExportsAccountDataWithBearerToken() async throws {
        let loader = RecordingDataLoader(json: """
        {
          "exportedAt": "2026-07-07T12:00:00.000Z",
          "data": {
            "account": {
              "login": "noc2"
            }
          },
          "notes": ["Daily running distance totals are exported without raw workouts."]
        }
        """)
        let client = PacePushAPIClient(baseURL: try XCTUnwrap(URL(string: "https://example.test")), token: "token-123", dataLoader: loader)

        let body = try await client.exportAccountData()

        XCTAssertTrue(body.contains(#""exportedAt""#))
        XCTAssertEqual(loader.requests.first?.httpMethod, "GET")
        XCTAssertEqual(loader.requests.first?.url?.path, "/api/mobile/me/privacy-export")
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "accept"), "application/json")
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "authorization"), "Bearer token-123")
    }

    func testAPIClientDeletesAccountWithBearerToken() async throws {
        let loader = RecordingDataLoader(json: """
        {
          "login": "noc2",
          "status": "deleted",
          "deletedAt": "2026-07-07T12:00:00.000Z"
        }
        """)
        let client = PacePushAPIClient(baseURL: try XCTUnwrap(URL(string: "https://example.test")), token: "token-123", dataLoader: loader)

        let response = try await client.deleteAccount()

        XCTAssertEqual(response.login, "noc2")
        XCTAssertEqual(response.status, "deleted")
        XCTAssertEqual(response.deletedAt, "2026-07-07T12:00:00.000Z")
        XCTAssertEqual(loader.requests.first?.httpMethod, "DELETE")
        XCTAssertEqual(loader.requests.first?.url?.path, "/api/mobile/me/delete")
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "accept"), "application/json")
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "authorization"), "Bearer token-123")
    }

    func testAPIClientExchangesMobileAuthCodeWithPKCEVerifier() async throws {
        let loader = RecordingDataLoader(json: """
        {
          "device": {
            "id": "device-1",
            "platform": "ios",
            "label": "Test iPhone",
            "lastSeenAt": null,
            "revoked": false
          },
          "token": "device-token"
        }
        """)
        let client = PacePushAPIClient(baseURL: try XCTUnwrap(URL(string: "https://example.test")), token: nil, dataLoader: loader)

        let response = try await client.exchangeMobileAuthCode("pp_mob_exchange_test", codeVerifier: "verifier-123")
        let body = try XCTUnwrap(loader.requests.first?.httpBody)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: body) as? [String: String]
        )

        XCTAssertEqual(response.token, "device-token")
        XCTAssertEqual(loader.requests.first?.httpMethod, "POST")
        XCTAssertEqual(loader.requests.first?.url?.path, "/api/mobile/auth/exchange")
        XCTAssertEqual(json["code"], "pp_mob_exchange_test")
        XCTAssertEqual(json["codeVerifier"], "verifier-123")
    }

    @MainActor
    func testStoreExchangesPairingPayloadRefreshesAndRunsFirstSync() async throws {
        let keychain = InMemoryKeychain()
        let preferences = InMemoryPreferences(values: [
            "healthAuthorized": true,
            "publicLeaderboardPreference": true,
            "publicLeaderboardPreferenceChosen": true,
        ])
        let client = FakePacePushClient()
        client.distanceDaysResponse = DistanceDaysResponse(accepted: 1, flagged: 0)
        client.deviceExchangeResponse = Self.deviceExchangeResponse(token: "device-token")
        client.leaderboardResponse = LeaderboardResponse(period: "2026-07", board: .balanced, rows: [])
        client.meResponse = Self.meResponse(publicLeaderboard: true)
        client.profileResponse = Self.profileResponse()

        let store = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: [
                HealthKitDistanceDay(
                    id: "2026-07-02",
                    date: "2026-07-02",
                    meters: 1000,
                    sourcePlatform: "ios",
                    sourceHash: "healthkit-ios-running-2026-07-02-1000"
                ),
            ]),
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in client },
            deviceLabel: { "Test iPhone" },
            now: { date("2026-07-06T12:00:00.000Z") }
        )
        store.apiBaseURL = "http://localhost:3000"

        await store.exchangePairingPayload("pacepush://pair?code=pp_pair.test&baseUrl=http://localhost:3000/mobile/pair")

        XCTAssertEqual(store.deviceToken, "device-token")
        XCTAssertEqual(try keychain.readString(account: "mobileDeviceToken"), "device-token")
        XCTAssertEqual(client.exchangedPairingCodes, ["pp_pair.test"])
        XCTAssertEqual(client.exchangedPairingLabels, ["Test iPhone"])
        XCTAssertEqual(client.uploadedDistanceDays.first?.map(\.date), ["2026-07-02"])
        XCTAssertEqual(client.recordedSyncRuns.first?.status, "success")
        XCTAssertNotNil(store.firstSyncAt)
        XCTAssertNil(store.lastError)
        XCTAssertEqual(store.lastSuccess, "Setup complete. Running data synced.")
    }

    @MainActor
    func testStoreShowsAccountLoadingDuringSlowPostAuthSetup() async throws {
        let keychain = InMemoryKeychain()
        let preferences = InMemoryPreferences(values: [
            "healthAuthorized": true,
            "publicLeaderboardPreference": true,
            "publicLeaderboardPreferenceChosen": true,
        ])
        let healthSync = FakeHealthSync(days: [
            HealthKitDistanceDay(
                id: "2026-07-02",
                date: "2026-07-02",
                meters: 1000,
                sourcePlatform: "ios",
                sourceHash: "healthkit-ios-running-2026-07-02-1000"
            ),
        ])
        healthSync.collectDelayNanoseconds = 200_000_000
        let client = FakePacePushClient()
        client.deviceExchangeResponse = Self.deviceExchangeResponse(token: "device-token")
        client.distanceDaysResponse = DistanceDaysResponse(accepted: 1, flagged: 0)
        client.leaderboardResponse = LeaderboardResponse(period: "2026-07", board: .balanced, rows: [])
        client.meResponse = Self.meResponse(publicLeaderboard: true)
        client.profileResponse = Self.profileResponse()

        let store = PacePushStore(
            keychain: keychain,
            healthSync: healthSync,
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in client },
            deviceLabel: { "Test iPhone" },
            now: { date("2026-07-06T12:00:00.000Z") }
        )

        let connectTask = Task { await store.connectGitHub() }
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertEqual(store.githubConnectionStatus, "@noc2")
        XCTAssertTrue(store.shouldShowAccountLoading)
        XCTAssertEqual(store.accountLoadPhase, .syncingInitialRun)
        XCTAssertEqual(store.accountLoadPhase.progressValue, 0.78, accuracy: 0.001)
        XCTAssertEqual(store.accountLoadingMessage, "Syncing running totals...")
        XCTAssertEqual(store.lastSyncStatus, "In progress")
        XCTAssertTrue(store.hasLoadedAccountSnapshot)
        XCTAssertNotEqual(store.me.login, "guest")

        await connectTask.value
        XCTAssertEqual(store.githubConnectionStatus, "@noc2")
        XCTAssertFalse(store.shouldShowAccountLoading)
        XCTAssertEqual(store.accountLoadPhase, .idle)
        XCTAssertNotNil(store.firstSyncAt)
        XCTAssertEqual(store.lastSuccess, "Setup complete. Running data synced.")
    }

    @MainActor
    func testOnboardingCompletesWhenGitHubAndHealthAreReadyBeforeFirstSync() throws {
        let keychain = InMemoryKeychain()
        try keychain.saveString("device-token", account: "mobileDeviceToken")

        let store = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: InMemoryPreferences(values: [
                "healthAuthorized": true,
                "publicLeaderboardPreferenceChosen": true,
            ]),
            apiClientFactory: { _, _ in FakePacePushClient() },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        XCTAssertTrue(store.onboardingComplete)
        XCTAssertTrue(store.canRetryFirstSync)
        XCTAssertNil(store.firstSyncAt)
    }

    @MainActor
    func testDemoModeUsesLocalSampleDataWithoutDeviceTokenOrNetworkCalls() async throws {
        let client = FakePacePushClient()
        let healthSync = FakeHealthSync(days: Self.distanceDays(count: 1))
        let preferences = InMemoryPreferences(values: [:])
        let store = PacePushStore(
            healthSync: healthSync,
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        store.startDemoMode()
        await store.refresh(board: .commits)
        let profile = try await store.fetchPublicProfile(
            login: "ship-sprint",
            period: try XCTUnwrap(ScorePeriod("2026-07"))
        )
        await store.syncRunningDistance()

        XCTAssertTrue(store.isDemoMode)
        XCTAssertTrue(store.onboardingComplete)
        XCTAssertNil(store.deviceToken)
        XCTAssertEqual(store.me.login, "demo-runner")
        XCTAssertEqual(store.profile.login, "demo-runner")
        XCTAssertEqual(profile.login, "ship-sprint")
        XCTAssertEqual(store.leaderboard.rows.count, 5)
        XCTAssertEqual(store.leaderboard.board, .commits)
        XCTAssertEqual(store.lastSuccess, "Demo mode uses sample running data.")
        XCTAssertTrue(preferences.bool(forKey: "demoModeEnabled"))
        XCTAssertTrue(client.leaderboardPeriods.isEmpty)
        XCTAssertTrue(client.mePeriods.isEmpty)
        XCTAssertTrue(client.profilePeriods.isEmpty)
        XCTAssertTrue(client.publicProfileLogins.isEmpty)
        XCTAssertTrue(client.uploadedDistanceDays.isEmpty)
        XCTAssertTrue(client.recordedSyncRuns.isEmpty)
        XCTAssertTrue(healthSync.requestedRanges.isEmpty)
    }

    @MainActor
    func testDemoModeRestoresAndExitsWithoutChangingKeychain() async throws {
        let keychain = InMemoryKeychain()
        let preferences = InMemoryPreferences(values: ["demoModeEnabled": true])
        let store = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in FakePacePushClient() },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        XCTAssertTrue(store.isDemoMode)
        XCTAssertTrue(store.onboardingComplete)
        XCTAssertEqual(store.me.login, "demo-runner")
        XCTAssertEqual(store.githubConnectionStatus, "Demo data")
        XCTAssertEqual(store.lastSyncStatus, "Demo data")

        store.exitDemoMode()

        XCTAssertFalse(store.isDemoMode)
        XCTAssertFalse(store.onboardingComplete)
        XCTAssertFalse(preferences.bool(forKey: "demoModeEnabled"))
        XCTAssertNil(try keychain.readString(account: "mobileDeviceToken"))
        XCTAssertEqual(store.me.login, "guest")
    }

    @MainActor
    func testSyncUploadsCurrentYearInApiSizedBatches() async throws {
        let keychain = InMemoryKeychain()
        try keychain.saveString("device-token", account: "mobileDeviceToken")
        let healthSync = FakeHealthSync(days: Self.distanceDays(count: 47))
        let client = FakePacePushClient()
        client.meResponse = Self.meResponse(publicLeaderboard: true)
        client.profileResponse = Self.profileResponse()

        let store = PacePushStore(
            keychain: keychain,
            healthSync: healthSync,
            authSession: FakeGitHubAuthSession(),
            preferences: InMemoryPreferences(values: ["healthAuthorized": true]),
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        await store.syncRunningDistance()

        XCTAssertEqual(healthSync.requestedRanges.first?.start, date("2026-01-01T00:00:00.000Z"))
        XCTAssertEqual(healthSync.requestedRanges.first?.end, date("2026-07-06T12:00:00.000Z"))
        XCTAssertEqual(client.uploadedDistanceDays.map(\.count), [45, 2])
        XCTAssertEqual(client.uploadedDistanceDays.first?.first?.date, "2026-01-01")
        XCTAssertEqual(client.uploadedDistanceDays.last?.last?.date, "2026-02-16")
        XCTAssertEqual(client.recordedSyncRuns.first?.counters["days"], 47)
        XCTAssertEqual(client.recordedSyncRuns.first?.counters["accepted"], 47)
        XCTAssertEqual(client.recordedSyncRuns.first?.status, "success")
    }

    @MainActor
    func testSyncShowsRepairHintWhenNoRunningDistanceIsFound() async throws {
        let keychain = InMemoryKeychain()
        try keychain.saveString("device-token", account: "mobileDeviceToken")
        let client = FakePacePushClient()
        client.distanceDaysResponse = DistanceDaysResponse(accepted: 0, flagged: 0)
        client.meResponse = Self.meResponse(publicLeaderboard: true)
        client.profileResponse = Self.profileResponse()

        let store = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: InMemoryPreferences(values: ["healthAuthorized": true]),
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        await store.syncRunningDistance()

        XCTAssertEqual(client.recordedSyncRuns.first?.status, "warning")
        XCTAssertTrue(store.lastSuccess?.contains("No running distance found") == true)
        XCTAssertTrue(store.lastSuccess?.contains("check Apple Health sharing") == true)
        XCTAssertNil(store.lastError)
    }

    @MainActor
    func testRequestHealthAccessShowsRepairHintWhenAuthorizationFails() async throws {
        let healthSync = FakeHealthSync(days: [])
        healthSync.authorizationError = PacePushAPIError.server("denied")
        let store = PacePushStore(
            healthSync: healthSync,
            authSession: FakeGitHubAuthSession(),
            preferences: InMemoryPreferences(values: [:]),
            apiClientFactory: { _, _ in FakePacePushClient() },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        await store.requestHealthAccess()

        XCTAssertTrue(store.lastError?.contains("Settings > Health > Data Access & Devices") == true)
        XCTAssertFalse(store.healthAuthorized)
    }

    @MainActor
    func testShareProfileURLRequiresConnectedAccountAndFirstSync() async throws {
        let keychain = InMemoryKeychain()
        try keychain.saveString("device-token", account: "mobileDeviceToken")
        let client = FakePacePushClient()
        client.meResponse = Self.meResponse(publicLeaderboard: true)
        client.profileResponse = Self.profileResponse()
        let preferences = InMemoryPreferences(values: [:])
        let store = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        await store.refresh()
        XCTAssertNil(store.shareProfileURL)

        preferences.set("2026-07-06T12:00:00.000Z", forKey: "firstSyncAt")
        let syncedStore = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )
        await syncedStore.refresh()

        XCTAssertEqual(syncedStore.shareProfileURL?.absoluteString, "https://paceandpush.com/users/noc2")
    }

    @MainActor
    func testBootstrapRunsHistoricalBackfillOnceForExistingDevice() async throws {
        let keychain = InMemoryKeychain()
        try keychain.saveString("device-token", account: "mobileDeviceToken")
        let preferences = InMemoryPreferences(values: [
            "healthAuthorized": true,
            "firstSyncAt": "2026-07-01T00:00:00.000Z",
        ])
        let healthSync = FakeHealthSync(days: Self.distanceDays(count: 2))
        let client = FakePacePushClient()
        client.meResponse = Self.meResponse(publicLeaderboard: true)
        client.profileResponse = Self.profileResponse()

        let store = PacePushStore(
            keychain: keychain,
            healthSync: healthSync,
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") }
        )

        await store.bootstrap()
        await store.bootstrap()

        XCTAssertEqual(client.uploadedDistanceDays.map(\.count), [2])
        XCTAssertEqual(healthSync.requestedRanges.count, 1)
        XCTAssertEqual(healthSync.requestedRanges.first?.start, date("2026-01-01T00:00:00.000Z"))
        XCTAssertEqual(preferences.string(forKey: "historicalDistanceSyncVersion"), "current-utc-year-v1")
    }

    @MainActor
    func testStoreRefreshesSelectedPeriodAcrossScoreSurfaces() async throws {
        let keychain = InMemoryKeychain()
        try keychain.saveString("device-token", account: "mobileDeviceToken")
        let client = FakePacePushClient()
        client.leaderboardResponse = LeaderboardResponse(period: "2026", board: .distance, rows: [])
        client.meResponse = Self.meResponse(publicLeaderboard: true)
        client.profileResponse = Self.profileResponse()

        let store = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: InMemoryPreferences(values: [:]),
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        await store.setActivePeriod(ScorePeriod(kind: .year, date: date("2026-07-06T12:00:00.000Z")), board: .distance)

        XCTAssertEqual(store.activePeriod.rawValue, "2026")
        XCTAssertEqual(client.leaderboardPeriods, ["2026"])
        XCTAssertEqual(client.mePeriods, ["2026"])
        XCTAssertEqual(client.profilePeriods, ["2026"])
    }

    @MainActor
    func testStoreFetchesPublicProfileForSelectedLeaderboardUser() async throws {
        let client = FakePacePushClient()
        client.publicProfileResponse = PublicProfileResponse(
            login: "octocat",
            displayName: "Octo Cat",
            bio: nil,
            score: ScoreSummary(period: "2026-07", score: 51.2, rank: 2, commits: 88, kilometers: 12.3, lastSyncAt: nil),
            history: []
        )
        let store = PacePushStore(
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: InMemoryPreferences(values: [:]),
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        let profile = try await store.fetchPublicProfile(
            login: "octocat",
            period: try XCTUnwrap(ScorePeriod("2026-07"))
        )

        XCTAssertEqual(profile.login, "octocat")
        XCTAssertEqual(client.publicProfileLogins, ["octocat"])
        XCTAssertEqual(client.publicProfilePeriods, ["2026-07"])
    }

    @MainActor
    func testStoreDisconnectsGitHubOnServerAndClearsLocalDeviceToken() async throws {
        let keychain = InMemoryKeychain()
        try keychain.saveString("device-token", account: "mobileDeviceToken")
        let preferences = InMemoryPreferences(values: [
            "healthAuthorized": true,
            "firstSyncAt": "2026-07-01T00:00:00.000Z",
            "historicalDistanceSyncVersion": "current-utc-year-v1",
        ])
        let client = FakePacePushClient()

        let store = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        await store.disconnectGitHub()

        XCTAssertEqual(client.disconnectGitHubCallCount, 1)
        XCTAssertNil(try keychain.readString(account: "mobileDeviceToken"))
        XCTAssertNil(store.deviceToken)
        XCTAssertNil(store.firstSyncAt)
        XCTAssertNil(preferences.string(forKey: "firstSyncAt"))
        XCTAssertNil(preferences.string(forKey: "historicalDistanceSyncVersion"))
        XCTAssertEqual(store.lastSuccess, "Signed out. GitHub contribution access is off.")
        XCTAssertNil(store.lastError)
    }

    @MainActor
    func testStoreClearsLocalDeviceTokenBeforeGitHubDisconnectCompletes() async throws {
        let keychain = InMemoryKeychain()
        try keychain.saveString("device-token", account: "mobileDeviceToken")
        let preferences = InMemoryPreferences(values: [
            "healthAuthorized": true,
            "firstSyncAt": "2026-07-01T00:00:00.000Z",
            "historicalDistanceSyncVersion": "current-utc-year-v1",
        ])
        let client = FakePacePushClient()
        client.disconnectGitHubDelayNanoseconds = 200_000_000

        let store = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        let disconnectTask = Task { await store.disconnectGitHub() }
        try await Task.sleep(nanoseconds: 50_000_000)

        XCTAssertNil(try keychain.readString(account: "mobileDeviceToken"))
        XCTAssertNil(store.deviceToken)
        XCTAssertNil(store.firstSyncAt)
        XCTAssertNil(preferences.string(forKey: "firstSyncAt"))
        XCTAssertNil(preferences.string(forKey: "historicalDistanceSyncVersion"))
        XCTAssertFalse(store.busy)

        await disconnectTask.value
        XCTAssertEqual(client.disconnectGitHubCallCount, 1)
        XCTAssertEqual(store.lastSuccess, "Signed out. GitHub contribution access is off.")
        XCTAssertNil(store.lastError)
    }

    @MainActor
    func testStoreClearsLocalDeviceTokenWhenGitHubDisconnectReturnsError() async throws {
        let keychain = InMemoryKeychain()
        try keychain.saveString("device-token", account: "mobileDeviceToken")
        let preferences = InMemoryPreferences(values: [
            "healthAuthorized": true,
            "firstSyncAt": "2026-07-01T00:00:00.000Z",
            "historicalDistanceSyncVersion": "current-utc-year-v1",
        ])
        let client = FakePacePushClient()
        client.disconnectGitHubError = PacePushAPIError.server("score recompute failed")

        let store = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        await store.disconnectGitHub()

        XCTAssertEqual(client.disconnectGitHubCallCount, 1)
        XCTAssertNil(try keychain.readString(account: "mobileDeviceToken"))
        XCTAssertNil(store.deviceToken)
        XCTAssertNil(store.firstSyncAt)
        XCTAssertNil(preferences.string(forKey: "firstSyncAt"))
        XCTAssertNil(preferences.string(forKey: "historicalDistanceSyncVersion"))
        XCTAssertTrue(store.lastError?.contains("Signed out on this device") ?? false)
        XCTAssertNil(store.lastSuccess)
    }

    @MainActor
    func testStoreExportsAccountDataForSharing() async throws {
        let keychain = InMemoryKeychain()
        try keychain.saveString("device-token", account: "mobileDeviceToken")
        let client = FakePacePushClient()
        let store = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: InMemoryPreferences(values: [:]),
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        let export = await store.exportAccountData()

        XCTAssertEqual(client.exportAccountDataCallCount, 1)
        XCTAssertTrue(export?.text.contains(#""exportedAt""#) ?? false)
        XCTAssertEqual(store.lastSuccess, "Data export ready.")
        XCTAssertNil(store.lastError)
    }

    @MainActor
    func testStoreDeletesAccountAndClearsLocalDeviceToken() async throws {
        let keychain = InMemoryKeychain()
        try keychain.saveString("device-token", account: "mobileDeviceToken")
        let preferences = InMemoryPreferences(values: [
            "firstSyncAt": "2026-07-01T00:00:00.000Z",
            "historicalDistanceSyncVersion": "current-utc-year-v1",
        ])
        let client = FakePacePushClient()
        let store = PacePushStore(
            keychain: keychain,
            healthSync: FakeHealthSync(days: []),
            authSession: FakeGitHubAuthSession(),
            preferences: preferences,
            apiClientFactory: { _, _ in client },
            now: { date("2026-07-06T12:00:00.000Z") },
            bootstrapSyncEnabled: false
        )

        await store.deleteAccount()

        XCTAssertEqual(client.deleteAccountCallCount, 1)
        XCTAssertNil(try keychain.readString(account: "mobileDeviceToken"))
        XCTAssertNil(store.deviceToken)
        XCTAssertNil(store.firstSyncAt)
        XCTAssertNil(preferences.string(forKey: "firstSyncAt"))
        XCTAssertNil(preferences.string(forKey: "historicalDistanceSyncVersion"))
        XCTAssertEqual(store.lastSuccess, "Account deleted.")
        XCTAssertNil(store.lastError)
    }

    private static let meJSON = """
    {
      "login": "noc2",
      "displayName": "David",
      "publicLeaderboard": true,
      "units": "metric",
      "score": {
        "period": "2026-07",
        "score": 42.5,
        "rank": 1,
        "commits": 100,
        "kilometers": 25.5,
        "lastSyncAt": null
      },
      "devices": []
    }
    """

    fileprivate static func meResponse(publicLeaderboard: Bool) -> MeResponse {
        MeResponse(
            login: "noc2",
            displayName: "David",
            publicLeaderboard: publicLeaderboard,
            units: "metric",
            score: ScoreSummary(period: "2026-07", score: 42.5, rank: 1, commits: 100, kilometers: 25.5, lastSyncAt: nil),
            devices: []
        )
    }

    fileprivate static func profileResponse() -> PublicProfileResponse {
        PublicProfileResponse(
            login: "noc2",
            displayName: "David",
            bio: nil,
            score: MeResponse.seed.score,
            history: []
        )
    }

    fileprivate static func deviceExchangeResponse(token: String) -> DeviceExchangeResponse {
        DeviceExchangeResponse(
            device: MobileDeviceSummary(
                id: "device-1",
                platform: "ios",
                label: "Test iPhone",
                lastSeenAt: nil,
                revoked: false
            ),
            token: token
        )
    }
}

private final class RecordingDataLoader: URLSessionDataLoading {
    var requests: [URLRequest] = []
    private let data: Data
    private let statusCode: Int

    init(json: String, statusCode: Int = 200) {
        self.data = Data(json.utf8)
        self.statusCode = statusCode
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        requests.append(request)
        let response = HTTPURLResponse(
            url: request.url ?? URL(string: "https://example.test")!,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: ["content-type": "application/json"]
        )!
        return (data, response)
    }
}

private final class InMemoryKeychain: KeychainStoring {
    private var values: [String: String] = [:]

    func saveString(_ value: String, account: String) throws {
        values[account] = value
    }

    func readString(account: String) throws -> String? {
        values[account]
    }

    func delete(account: String) throws {
        values.removeValue(forKey: account)
    }
}

private final class InMemoryPreferences: PreferencesStoring {
    private var values: [String: Any]

    init(values: [String: Any] = [:]) {
        self.values = values
    }

    func string(forKey defaultName: String) -> String? {
        values[defaultName] as? String
    }

    func bool(forKey defaultName: String) -> Bool {
        values[defaultName] as? Bool ?? false
    }

    func object(forKey defaultName: String) -> Any? {
        values[defaultName]
    }

    func set(_ value: Any?, forKey defaultName: String) {
        values[defaultName] = value
    }

    func removeObject(forKey defaultName: String) {
        values.removeValue(forKey: defaultName)
    }
}

private final class FakeHealthSync: HealthDistanceSyncing {
    var isAvailable = true
    var authorizationError: Error?
    var collectDelayNanoseconds: UInt64 = 0
    let days: [HealthKitDistanceDay]
    private(set) var requestedRanges: [(start: Date, end: Date)] = []

    init(days: [HealthKitDistanceDay]) {
        self.days = days
    }

    func requestAuthorization() async throws {
        if let authorizationError {
            throw authorizationError
        }
    }

    func collectDistanceDays(from startDate: Date, through endDate: Date) async throws -> HealthKitDistanceSyncResult {
        if collectDelayNanoseconds > 0 {
            try await Task.sleep(nanoseconds: collectDelayNanoseconds)
        }
        requestedRanges.append((startDate, endDate))
        return HealthKitDistanceSyncResult(days: days, startedAt: startDate, finishedAt: endDate)
    }
}

private struct FakeGitHubAuthSession: GitHubAuthenticating {
    func authenticate(startURL: URL, callbackScheme: String) async throws -> URL {
        URL(string: "\(callbackScheme)://auth/callback?code=fake-code")!
    }
}

private final class FakePacePushClient: PacePushClienting {
    var deviceExchangeResponse = PacePushTests.deviceExchangeResponse(token: "token")
    var leaderboardResponse = LeaderboardResponse.seed
    var meResponse = MeResponse.seed
    var profileResponse = PublicProfileResponse.seed
    var publicProfileResponse = PublicProfileResponse.seed
    var settingsResponse = AccountSettingsResponse(login: "noc2", displayName: "David", publicLeaderboard: true, units: "metric")
    var distanceDaysResponse: DistanceDaysResponse?
    var exchangedPairingCodes: [String] = []
    var exchangedPairingLabels: [String] = []
    var uploadedDistanceDays: [[HealthKitDistanceDay]] = []
    var recordedSyncRuns: [SyncRunRequest] = []
    var leaderboardPeriods: [String] = []
    var mePeriods: [String] = []
    var profilePeriods: [String] = []
    var publicProfileLogins: [String] = []
    var publicProfilePeriods: [String] = []
    var disconnectGitHubCallCount = 0
    var exportAccountDataCallCount = 0
    var deleteAccountCallCount = 0
    var disconnectResponse = GitHubDisconnectResponse(login: "noc2", disconnectedAt: "2026-07-07T12:00:00.000Z")
    var disconnectGitHubError: Error?
    var disconnectGitHubDelayNanoseconds: UInt64 = 0

    func mobileGitHubStartURL(platform: String, label: String, callbackScheme: String, codeChallenge: String) throws -> URL {
        URL(string: "https://example.test/start?platform=\(platform)&callbackScheme=\(callbackScheme)&codeChallenge=\(codeChallenge)")!
    }

    func exchangeMobileAuthCode(_ code: String, codeVerifier: String) async throws -> DeviceExchangeResponse {
        deviceExchangeResponse
    }

    func exchangeDevicePairing(code: String, platform: String, label: String) async throws -> DeviceExchangeResponse {
        exchangedPairingCodes.append(code)
        exchangedPairingLabels.append(label)
        return deviceExchangeResponse
    }

    func disconnectGitHub() async throws -> GitHubDisconnectResponse {
        disconnectGitHubCallCount += 1
        if disconnectGitHubDelayNanoseconds > 0 {
            try await Task.sleep(nanoseconds: disconnectGitHubDelayNanoseconds)
        }
        if let disconnectGitHubError {
            throw disconnectGitHubError
        }
        return disconnectResponse
    }

    func exportAccountData() async throws -> String {
        exportAccountDataCallCount += 1
        return #"{"exportedAt":"2026-07-07T12:00:00.000Z","data":{"account":{"login":"noc2"}}}"#
    }

    func deleteAccount() async throws -> AccountDeletionResponse {
        deleteAccountCallCount += 1
        return AccountDeletionResponse(login: "noc2", status: "deleted", deletedAt: "2026-07-07T12:00:00.000Z")
    }

    func fetchLeaderboard(board: Board, period: String) async throws -> LeaderboardResponse {
        leaderboardPeriods.append(period)
        return leaderboardResponse
    }

    func fetchMe(period: String) async throws -> MeResponse {
        mePeriods.append(period)
        return meResponse
    }

    func fetchProfile(period: String) async throws -> PublicProfileResponse {
        profilePeriods.append(period)
        return profileResponse
    }

    func fetchPublicProfile(login: String, period: String) async throws -> PublicProfileResponse {
        publicProfileLogins.append(login)
        publicProfilePeriods.append(period)
        return publicProfileResponse
    }

    func updateSettings(publicLeaderboard: Bool?, units: String?) async throws -> AccountSettingsResponse {
        settingsResponse
    }

    func uploadDistanceDays(_ days: [HealthKitDistanceDay]) async throws -> DistanceDaysResponse {
        uploadedDistanceDays.append(days)
        return distanceDaysResponse ?? DistanceDaysResponse(accepted: days.count, flagged: 0)
    }

    func recordSyncRun(_ run: SyncRunRequest) async throws {
        recordedSyncRuns.append(run)
    }
}

private func date(_ value: String) -> Date {
    ISO8601DateFormatter.pacePush.date(from: value)!
}

private extension PacePushTests {
    static func distanceDays(count: Int) -> [HealthKitDistanceDay] {
        let start = date("2026-01-01T00:00:00.000Z")
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"

        return (0..<count).map { offset in
            let day = calendar.date(byAdding: .day, value: offset, to: start)!
            let dateString = formatter.string(from: day)
            return HealthKitDistanceDay(
                id: dateString,
                date: dateString,
                meters: Double(1_000 + offset),
                sourcePlatform: "ios",
                sourceHash: "healthkit-ios-running-\(dateString)-\(1_000 + offset)"
            )
        }
    }
}

private func queryValue(_ name: String, in url: URL?) -> String? {
    guard let url,
          let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    else {
        return nil
    }

    return components.queryItems?.first { $0.name == name }?.value
}
