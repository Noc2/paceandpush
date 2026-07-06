import Foundation
import XCTest
@testable import PacePush

final class PacePushTests: XCTestCase {
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
        XCTAssertEqual(
            Board.distance.leaderboardMetric(for: row, units: .imperial).value,
            DistanceUnits.imperial.format(row.kilometers)
        )
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
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "accept"), "application/json")
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "authorization"), "Bearer token-123")
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
        XCTAssertEqual(loader.requests.first?.value(forHTTPHeaderField: "authorization"), "Bearer token-123")
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

private struct FakeHealthSync: HealthDistanceSyncing {
    var isAvailable = true
    let days: [HealthKitDistanceDay]

    func requestAuthorization() async throws {}

    func collectDistanceDays(from startDate: Date, through endDate: Date) async throws -> HealthKitDistanceSyncResult {
        HealthKitDistanceSyncResult(days: days, startedAt: startDate, finishedAt: endDate)
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
    var settingsResponse = AccountSettingsResponse(login: "noc2", displayName: "David", publicLeaderboard: true, units: "metric")
    var distanceDaysResponse = DistanceDaysResponse(accepted: 0, flagged: 0)
    var exchangedPairingCodes: [String] = []
    var exchangedPairingLabels: [String] = []
    var uploadedDistanceDays: [[HealthKitDistanceDay]] = []
    var recordedSyncRuns: [SyncRunRequest] = []
    var leaderboardPeriods: [String] = []
    var mePeriods: [String] = []
    var profilePeriods: [String] = []

    func mobileGitHubStartURL(platform: String, label: String, callbackScheme: String) throws -> URL {
        URL(string: "https://example.test/start?platform=\(platform)&callbackScheme=\(callbackScheme)")!
    }

    func exchangeMobileAuthCode(_ code: String) async throws -> DeviceExchangeResponse {
        deviceExchangeResponse
    }

    func exchangeDevicePairing(code: String, platform: String, label: String) async throws -> DeviceExchangeResponse {
        exchangedPairingCodes.append(code)
        exchangedPairingLabels.append(label)
        return deviceExchangeResponse
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

    func updateSettings(publicLeaderboard: Bool?, units: String?) async throws -> AccountSettingsResponse {
        settingsResponse
    }

    func uploadDistanceDays(_ days: [HealthKitDistanceDay]) async throws -> DistanceDaysResponse {
        uploadedDistanceDays.append(days)
        return distanceDaysResponse
    }

    func recordSyncRun(_ run: SyncRunRequest) async throws {
        recordedSyncRuns.append(run)
    }
}

private func date(_ value: String) -> Date {
    ISO8601DateFormatter.pacePush.date(from: value)!
}

private func queryValue(_ name: String, in url: URL?) -> String? {
    guard let url,
          let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    else {
        return nil
    }

    return components.queryItems?.first { $0.name == name }?.value
}
