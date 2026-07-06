import AuthenticationServices
import Foundation
import Security
import SwiftUI
import UIKit

@main
struct PacePushApp: App {
    @StateObject private var store = PacePushStore()

    init() {
        BrandAppearance.apply()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .onOpenURL { url in
                    Task { await store.handleOpenURL(url) }
                }
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var store: PacePushStore

    var body: some View {
        Group {
            if store.onboardingComplete {
                MainTabsView()
            } else {
                OnboardingView()
            }
        }
        .tint(Brand.orange)
        .foregroundStyle(Brand.ink)
        .preferredColorScheme(.light)
        .task {
            await store.bootstrap()
        }
    }
}

struct MainTabsView: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "bolt.fill") }

            LeaderboardView()
                .tabItem { Label("Board", systemImage: "list.number") }

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.square") }

            SyncView()
                .tabItem { Label("Sync", systemImage: "arrow.triangle.2.circlepath") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}

struct OnboardingView: View {
    @EnvironmentObject private var store: PacePushStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HeaderView()

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Set up Pace & Push")
                            .font(.system(size: 36, weight: .black, design: .rounded))
                            .foregroundStyle(Brand.ink)
                    }
                    .panelStyle()

                    OnboardingStep(
                        index: 1,
                        title: "Connect GitHub",
                        detail: store.isGitHubConnected ? "@\(store.me.login) connected" : "Used for commit counts and account identity.",
                        complete: store.isGitHubConnected,
                    ) {
                        Button {
                            Task { await store.connectGitHub() }
                        } label: {
                            Label("Connect GitHub", systemImage: "chevron.right.square")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(store.busy)
                    }

                    OnboardingStep(
                        index: 2,
                        title: "Choose leaderboard visibility",
                        detail: store.publicLeaderboardPreference ? "Your score can appear on public boards." : "Your score stays private.",
                        complete: store.publicLeaderboardPreferenceChosen,
                        showsActionsWhenComplete: true,
                    ) {
                        Toggle(
                            "Public leaderboard",
                            isOn: Binding(
                                get: { store.publicLeaderboardPreference },
                                set: { value in
                                    Task { await store.setPublicLeaderboardPreference(value) }
                                },
                            ),
                        )
                        .disabled(store.busy)
                    }

                    OnboardingStep(
                        index: 3,
                        title: "Enable Apple Health",
                        detail: store.healthAuthorized ? "Read-only workout access enabled" : "Pace & Push reads running workouts only.",
                        complete: store.healthAuthorized,
                    ) {
                        Button {
                            Task { await store.requestHealthAccess() }
                        } label: {
                            Label("Enable Health", systemImage: "heart.text.square")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(store.busy || !store.isGitHubConnected)
                    }

                    OnboardingStep(
                        index: 4,
                        title: "Run first sync",
                        detail: store.firstSyncAt == nil ? "Upload daily running totals, not raw workouts." : "First sync complete.",
                        complete: store.firstSyncAt != nil,
                    ) {
                        Button {
                            Task { await store.syncRunningDistance() }
                        } label: {
                            Label("Sync Running Data", systemImage: "arrow.triangle.2.circlepath")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(store.busy || !store.healthAuthorized)
                    }

                    if let error = store.lastError {
                        Text(error)
                            .font(.callout.weight(.semibold))
                            .foregroundStyle(Brand.red)
                            .panelStyle()
                    } else if let success = store.lastSuccess {
                        Text(success)
                            .font(.callout.weight(.semibold))
                            .foregroundStyle(Brand.green)
                            .panelStyle()
                    }
                }
                .padding(20)
            }
            .background(Brand.paper)
        }
    }
}

struct OnboardingStep<Actions: View>: View {
    let index: Int
    let title: String
    let detail: String
    let complete: Bool
    let showsActionsWhenComplete: Bool
    @ViewBuilder let actions: () -> Actions

    init(
        index: Int,
        title: String,
        detail: String,
        complete: Bool,
        showsActionsWhenComplete: Bool = false,
        @ViewBuilder actions: @escaping () -> Actions,
    ) {
        self.index = index
        self.title = title
        self.detail = detail
        self.complete = complete
        self.showsActionsWhenComplete = showsActionsWhenComplete
        self.actions = actions
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Text(complete ? "✓" : "\(index)")
                    .font(.headline.monospaced())
                    .frame(width: 34, height: 34)
                    .background(complete ? Brand.green.opacity(0.18) : Brand.orange)
                    .overlay(Rectangle().stroke(Brand.ink, lineWidth: 2))

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.title3.bold())
                    Text(detail)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(Brand.muted)
                }
            }

            if showsActionsWhenComplete || !complete {
                actions()
            }
        }
        .panelStyle()
    }
}

struct TodayView: View {
    @EnvironmentObject private var store: PacePushStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HeaderView()

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Your \(store.me.score.period) score")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Brand.muted)
                            .textCase(.uppercase)

                        Text(store.me.score.score.formatted(.number.precision(.fractionLength(1))))
                            .font(.system(size: 72, weight: .black, design: .rounded))
                            .foregroundStyle(Brand.ink)

                        Text(store.me.score.rank.map { "Rank #\($0) this month." } ?? "No public rank yet.")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(Brand.muted)
                    }
                    .panelStyle()

                    HStack(spacing: 12) {
                        MetricTile(title: "Commits", value: "\(store.me.score.commits)", color: Brand.green)
                        MetricTile(
                            title: store.units.title,
                            value: store.formatDistance(store.me.score.kilometers),
                            color: Brand.red
                        )
                    }

                    HStack(spacing: 12) {
                        MetricTile(title: "Board", value: store.me.score.rank.map { "#\($0)" } ?? "-", color: Brand.blue)
                        MetricTile(title: "Sync", value: store.me.score.lastSyncAt == nil ? "Never" : "Ready", color: Brand.ink)
                    }
                }
                .padding(20)
            }
            .background(Brand.paper)
            .refreshable {
                await store.refresh()
            }
        }
    }
}

struct LeaderboardView: View {
    @EnvironmentObject private var store: PacePushStore
    @State private var board = Board.balanced
    @State private var searchText = ""

    var rows: [LeaderboardRow] {
        let filteredRows = filteredLeaderboardRows
        switch board {
        case .balanced:
            return filteredRows.sorted { $0.score > $1.score }
        case .commits:
            return filteredRows.sorted { $0.commits > $1.commits }
        case .distance:
            return filteredRows.sorted { $0.kilometers > $1.kilometers }
        }
    }

    var filteredLeaderboardRows: [LeaderboardRow] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return store.leaderboard.rows }

        return store.leaderboard.rows.filter { row in
            row.login.localizedCaseInsensitiveContains(query) ||
            row.displayName.localizedCaseInsensitiveContains(query)
        }
    }

    var emptyMessage: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "No public scores yet."
            : "No matching public developers."
    }

    var body: some View {
        NavigationStack {
            List {
                Picker("Board", selection: $board) {
                    ForEach(Board.allCases) { item in
                        Text(item.title).tag(item)
                    }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Brand.paper)

                if rows.isEmpty {
                    Text(emptyMessage)
                        .foregroundStyle(Brand.muted)
                        .listRowBackground(Brand.paper)
                }

                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    LeaderboardRowView(rank: index + 1, row: row, units: store.units)
                        .listRowBackground(Brand.paper)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Brand.paper)
            .foregroundStyle(Brand.ink)
            .navigationTitle("Leaderboard")
            .searchable(text: $searchText, prompt: "Developer")
            .toolbar {
                Button {
                    Task { await store.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject private var store: PacePushStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HeaderView()

                    VStack(alignment: .leading, spacing: 12) {
                        Text("@\(store.profile.login)")
                            .font(.title.bold())
                        Text(store.profile.bio ?? "Healthy body, shipped code.")
                            .foregroundStyle(Brand.muted)

                        if store.profile.history.isEmpty {
                            Text("Sync running data to build your profile history.")
                                .foregroundStyle(Brand.muted)
                        }

                        ForEach(store.profile.history) { point in
                            HStack {
                                Text(point.date)
                                    .font(.system(.body, design: .monospaced))
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text(point.score.formatted(.number.precision(.fractionLength(1))))
                                        .foregroundStyle(Brand.blue)
                                        .fontWeight(.bold)
                                    Text(store.formatDistance(point.kilometers, includeUnit: true))
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(Brand.muted)
                                }
                            }
                            .padding(.vertical, 6)
                            .borderedRow()
                        }
                    }
                    .panelStyle()
                }
                .padding(20)
            }
            .background(Brand.paper)
            .navigationTitle("Profile")
        }
    }
}

struct SyncView: View {
    @EnvironmentObject private var store: PacePushStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HeaderView()

                    VStack(alignment: .leading, spacing: 12) {
                        Label("Running sync", systemImage: "figure.run")
                            .font(.title3.bold())

                        StatusRow(label: "GitHub", value: store.isGitHubConnected ? "@\(store.me.login)" : "Disconnected")
                        StatusRow(label: "Apple Health", value: store.healthAuthorized ? "Enabled" : "Needs permission")
                        StatusRow(label: "Last sync", value: store.firstSyncAt ?? "Never")

                        Button {
                            Task { await store.syncRunningDistance() }
                        } label: {
                            Label(store.busy ? "Syncing..." : "Sync Now", systemImage: "arrow.triangle.2.circlepath")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(store.busy || !store.healthAuthorized)

                        if let error = store.lastError {
                            Text(error)
                                .font(.callout.weight(.semibold))
                                .foregroundStyle(Brand.red)
                        }
                    }
                    .panelStyle()
                }
                .padding(20)
            }
            .background(Brand.paper)
            .navigationTitle("Sync")
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var store: PacePushStore

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    Text("@\(store.me.login)")
                    Button(role: .destructive) {
                        store.signOut()
                    } label: {
                        Text("Sign out")
                            .foregroundStyle(Brand.red)
                    }
                }

                Section("Server") {
                    TextField("API base URL", text: $store.apiBaseURL)
                        .font(Font.system(.body, design: .monospaced))
                        .foregroundStyle(Brand.ink)
                }

                Section("Units") {
                    Picker("Distance", selection: $store.units) {
                        ForEach(DistanceUnits.allCases) { units in
                            Text(units.title).tag(units)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Privacy") {
                    Toggle(
                        "Public leaderboard",
                        isOn: Binding(
                            get: { store.publicLeaderboardPreference },
                            set: { value in
                                Task { await store.setPublicLeaderboardPreference(value) }
                            },
                        ),
                    )
                    .disabled(store.busy)
                    Text("Running distance summaries are synced by day. Raw workouts and routes are not uploaded.")
                        .foregroundStyle(Brand.muted)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Brand.paper)
            .foregroundStyle(Brand.ink)
            .navigationTitle("Settings")
        }
    }
}

struct StatusRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(Brand.muted)
            Spacer()
            Text(value)
                .fontWeight(.bold)
        }
    }
}

struct HeaderView: View {
    var body: some View {
        HStack(spacing: 12) {
            Text(">")
                .font(.system(size: 34, weight: .black, design: .monospaced))
                .foregroundStyle(Brand.ink)
                .frame(width: 48, height: 48)
                .background(Brand.orange)
                .overlay(Rectangle().stroke(Brand.ink, lineWidth: 3))

            VStack(alignment: .leading, spacing: 2) {
                Text("Pace & Push")
                    .font(.title.bold())
                Text("Healthy body, shipped code.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Brand.muted)
            }
        }
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(Brand.muted)
                .textCase(.uppercase)
            Text(value)
                .font(.title.bold())
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .panelStyle()
    }
}

struct LeaderboardRowView: View {
    let rank: Int
    let row: LeaderboardRow
    let units: DistanceUnits

    var body: some View {
        HStack(spacing: 12) {
            Text(String(format: "%02d", rank))
                .font(.system(.headline, design: .monospaced))
                .frame(width: 38, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                Text(row.login)
                    .font(.headline.monospaced())
                Text(row.displayName)
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(row.score.formatted(.number.precision(.fractionLength(1))))
                    .font(.headline.monospaced())
                    .foregroundStyle(Brand.blue)
                Text(units.format(row.kilometers, includeUnit: true))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Brand.muted)
            }
        }
        .padding(.vertical, 8)
    }
}

@MainActor
final class PacePushStore: ObservableObject {
    private let callbackScheme = "pacepush"
    private let tokenKey = "mobileDeviceToken"
    private let healthKey = "healthAuthorized"
    private let firstSyncKey = "firstSyncAt"
    private let unitsKey = "distanceUnits"
    private let publicLeaderboardPreferenceKey = "publicLeaderboardPreference"
    private let publicLeaderboardPreferenceChosenKey = "publicLeaderboardPreferenceChosen"
    private let keychain = KeychainStore(service: "com.paceandpush.app")
    private let healthSync = HealthKitDistanceSync()
    private let authSession = GitHubAuthSession()

    @Published var leaderboard = LeaderboardResponse.seed
    @Published var me = MeResponse.seed
    @Published var profile = PublicProfileResponse.seed
    @Published var apiBaseURL = "https://paceandpush.com"
    @Published var deviceToken: String?
    @Published var healthAuthorized: Bool
    @Published var firstSyncAt: String?
    @Published var publicLeaderboardPreference: Bool
    @Published var publicLeaderboardPreferenceChosen: Bool
    @Published var lastError: String?
    @Published var lastSuccess: String?
    @Published var busy = false
    @Published var units: DistanceUnits {
        didSet {
            UserDefaults.standard.set(units.rawValue, forKey: unitsKey)
        }
    }

    var isGitHubConnected: Bool {
        deviceToken != nil
    }

    var onboardingComplete: Bool {
        isGitHubConnected && healthAuthorized && firstSyncAt != nil
    }

    init() {
        let savedUnits = UserDefaults.standard.string(forKey: unitsKey)
        units = DistanceUnits(rawValue: savedUnits ?? "") ?? .metric
        healthAuthorized = UserDefaults.standard.bool(forKey: healthKey)
        firstSyncAt = UserDefaults.standard.string(forKey: firstSyncKey)
        publicLeaderboardPreference = UserDefaults.standard.object(forKey: publicLeaderboardPreferenceKey) as? Bool ?? true
        publicLeaderboardPreferenceChosen = UserDefaults.standard.bool(forKey: publicLeaderboardPreferenceChosenKey)
        deviceToken = try? keychain.readString(account: tokenKey)
    }

    func bootstrap() async {
        guard deviceToken != nil else { return }
        await refresh()
    }

    func connectGitHub() async {
        guard let baseURL = URL(string: apiBaseURL) else {
            lastError = "API base URL is invalid."
            lastSuccess = nil
            return
        }

        busy = true
        lastError = nil
        lastSuccess = nil
        defer { busy = false }

        do {
            let client = PacePushAPIClient(baseURL: baseURL, token: nil)
            let callback = try await authSession.authenticate(
                startURL: client.mobileGitHubStartURL(
                    platform: "ios",
                    label: UIDevice.current.name,
                    callbackScheme: callbackScheme,
                ),
                callbackScheme: callbackScheme,
            )
            try await finishGitHubCallback(callback)
        } catch {
            lastError = userFacingGitHubConnectionError(error)
            lastSuccess = nil
        }
    }

    func handleOpenURL(_ url: URL) async {
        if PairingPayloadParser.isPairingURL(url, apiBaseURL: URL(string: apiBaseURL), callbackScheme: callbackScheme) {
            await exchangePairingPayload(url.absoluteString)
            return
        }

        await handleAuthCallback(url)
    }

    func handleAuthCallback(_ url: URL) async {
        do {
            try await finishGitHubCallback(url)
        } catch {
            lastError = userFacingGitHubConnectionError(error)
            lastSuccess = nil
        }
    }

    func exchangePairingPayload(_ payload: String) async {
        let currentBaseURL = URL(string: apiBaseURL)

        guard let pairing = PairingPayloadParser.parse(
            payload,
            apiBaseURL: currentBaseURL,
            callbackScheme: callbackScheme,
        ) else {
            lastError = PacePushAPIError.invalidPairingCode.localizedDescription
            lastSuccess = nil
            return
        }

        guard let baseURL = pairing.baseURL ?? currentBaseURL else {
            lastError = "API base URL is invalid."
            lastSuccess = nil
            return
        }

        busy = true
        lastError = nil
        lastSuccess = nil
        defer { busy = false }

        do {
            try await finishPairing(pairing, baseURL: baseURL)
        } catch {
            lastError = error.localizedDescription
            lastSuccess = nil
        }
    }

    func requestHealthAccess() async {
        busy = true
        lastError = nil
        lastSuccess = nil
        defer { busy = false }

        do {
            try await healthSync.requestAuthorization()
            healthAuthorized = true
            UserDefaults.standard.set(true, forKey: healthKey)
        } catch {
            lastError = "Apple Health is unavailable or permission was not granted."
            lastSuccess = nil
        }
    }

    func setPublicLeaderboardPreference(_ isPublic: Bool) async {
        publicLeaderboardPreference = isPublic
        publicLeaderboardPreferenceChosen = true
        UserDefaults.standard.set(isPublic, forKey: publicLeaderboardPreferenceKey)
        UserDefaults.standard.set(true, forKey: publicLeaderboardPreferenceChosenKey)

        guard let token = deviceToken, let baseURL = URL(string: apiBaseURL) else { return }

        busy = true
        lastError = nil
        lastSuccess = nil
        defer { busy = false }

        do {
            try await savePublicLeaderboardPreference(isPublic, baseURL: baseURL, token: token)
            await refresh()
        } catch PacePushAPIError.unauthorized {
            signOut()
            lastError = "This device was revoked. Connect GitHub again."
        } catch {
            publicLeaderboardPreference = me.publicLeaderboard
            UserDefaults.standard.set(publicLeaderboardPreference, forKey: publicLeaderboardPreferenceKey)
            lastError = error.localizedDescription
            lastSuccess = nil
        }
    }

    func syncRunningDistance() async {
        guard let token = deviceToken, let baseURL = URL(string: apiBaseURL) else {
            lastError = "Connect GitHub before syncing."
            lastSuccess = nil
            return
        }

        busy = true
        lastError = nil
        lastSuccess = nil
        let startedAt = Date()

        do {
            let client = PacePushAPIClient(baseURL: baseURL, token: token)
            let startDate = Calendar(identifier: .gregorian).date(byAdding: .day, value: -35, to: Date()) ?? Date()
            let result = try await healthSync.collectDistanceDays(from: startDate)
            let upload = try await client.uploadDistanceDays(result.days)
            try await client.recordSyncRun(
                SyncRunRequest(
                    platform: "ios",
                    status: upload.flagged > 0 ? "warning" : "success",
                    startedAt: startedAt.isoString,
                    finishedAt: Date().isoString,
                    counters: [
                        "days": result.days.count,
                        "accepted": upload.accepted,
                        "flagged": upload.flagged,
                    ],
                    errorSummary: nil,
                ),
            )
            firstSyncAt = Date().isoString
            UserDefaults.standard.set(firstSyncAt, forKey: firstSyncKey)
            await refresh()
        } catch PacePushAPIError.unauthorized {
            signOut()
            lastError = "This device was revoked. Connect GitHub again."
        } catch {
            if let client = URL(string: apiBaseURL).map({ PacePushAPIClient(baseURL: $0, token: token) }) {
                try? await client.recordSyncRun(
                    SyncRunRequest(
                        platform: "ios",
                        status: "error",
                        startedAt: startedAt.isoString,
                        finishedAt: Date().isoString,
                        counters: [:],
                        errorSummary: error.localizedDescription,
                    ),
                )
            }
            lastError = error.localizedDescription
            lastSuccess = nil
        }

        busy = false
    }

    func refresh() async {
        guard let baseURL = URL(string: apiBaseURL) else { return }

        do {
            let client = PacePushAPIClient(baseURL: baseURL, token: deviceToken)
            async let leaderboardResponse: LeaderboardResponse = client.fetch("/api/leaderboard", authenticated: false)
            if deviceToken != nil {
                async let meResponse: MeResponse = client.fetch("/api/mobile/me", authenticated: true)
                async let profileResponse: PublicProfileResponse = client.fetch("/api/mobile/me/profile", authenticated: true)
                leaderboard = try await leaderboardResponse
                me = try await meResponse
                publicLeaderboardPreference = me.publicLeaderboard
                publicLeaderboardPreferenceChosen = true
                UserDefaults.standard.set(publicLeaderboardPreference, forKey: publicLeaderboardPreferenceKey)
                UserDefaults.standard.set(true, forKey: publicLeaderboardPreferenceChosenKey)
                profile = try await profileResponse
            } else {
                leaderboard = try await leaderboardResponse
            }
            lastError = nil
        } catch PacePushAPIError.unauthorized {
            signOut()
            lastError = "This device was revoked. Connect GitHub again."
            lastSuccess = nil
        } catch {
            lastError = error.localizedDescription
            lastSuccess = nil
        }
    }

    func signOut() {
        try? keychain.delete(account: tokenKey)
        deviceToken = nil
        firstSyncAt = nil
        UserDefaults.standard.removeObject(forKey: firstSyncKey)
        me = .seed
        profile = .seed
        lastSuccess = nil
    }

    private func savePublicLeaderboardPreference(_ isPublic: Bool, baseURL: URL, token: String) async throws {
        let client = PacePushAPIClient(baseURL: baseURL, token: token)
        let settings: AccountSettingsResponse = try await client.patch(
            "/api/mobile/me/settings",
            body: AccountSettingsRequest(publicLeaderboard: isPublic, units: nil),
            authenticated: true,
        )
        publicLeaderboardPreference = settings.publicLeaderboard
        publicLeaderboardPreferenceChosen = true
        UserDefaults.standard.set(settings.publicLeaderboard, forKey: publicLeaderboardPreferenceKey)
        UserDefaults.standard.set(true, forKey: publicLeaderboardPreferenceChosenKey)
    }

    func formatDistance(_ kilometers: Double, includeUnit: Bool = false) -> String {
        units.format(kilometers, includeUnit: includeUnit)
    }

    private func finishGitHubCallback(_ url: URL) async throws {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw PacePushAPIError.invalidCallback
        }
        if let code = components.queryItems?.first(where: { $0.name == "error" })?.value {
            throw PacePushAPIError.server(mobileGitHubCallbackErrorMessage(code))
        }
        guard let code = components.queryItems?.first(where: { $0.name == "code" })?.value,
              let baseURL = URL(string: apiBaseURL)
        else {
            throw PacePushAPIError.invalidCallback
        }

        let preferredPublicLeaderboard = publicLeaderboardPreference
        let shouldSyncPublicLeaderboardPreference = publicLeaderboardPreferenceChosen
        let client = PacePushAPIClient(baseURL: baseURL, token: nil)
        let exchange: DeviceExchangeResponse = try await client.post(
            "/api/mobile/auth/exchange",
            body: MobileAuthExchangeRequest(code: code),
            authenticated: false,
        )
        try keychain.saveString(exchange.token, account: tokenKey)
        deviceToken = exchange.token
        if shouldSyncPublicLeaderboardPreference {
            try? await savePublicLeaderboardPreference(
                preferredPublicLeaderboard,
                baseURL: baseURL,
                token: exchange.token,
            )
        }
        await refresh()
        if lastError == nil {
            lastSuccess = "GitHub connected. Next, enable Apple Health."
        }
    }

    private func userFacingGitHubConnectionError(_ error: Error) -> String {
        if let apiError = error as? PacePushAPIError,
           case .server(let message) = apiError {
            return mobileGitHubCallbackErrorMessage(message)
        }

        return error.localizedDescription
    }

    private func mobileGitHubCallbackErrorMessage(_ code: String) -> String {
        switch code {
        case "github_callback_invalid":
            return "GitHub sign-in did not return a valid callback. Please try again."
        case "github_connection_expired":
            return "GitHub sign-in expired. Please start GitHub connection again."
        case "github_connection_failed":
            return "GitHub sign-in worked, but Pace & Push could not finish device setup. Please try again."
        default:
            if code.localizedCaseInsensitiveContains("failed query") ||
                code.localizedCaseInsensitiveContains("mobile_auth_exchanges") {
                return "GitHub sign-in worked, but Pace & Push could not finish device setup. Please try again."
            }
            return code
        }
    }

    private func finishPairing(_ pairing: PairingPayload, baseURL: URL) async throws {
        let preferredPublicLeaderboard = publicLeaderboardPreference
        let shouldSyncPublicLeaderboardPreference = publicLeaderboardPreferenceChosen
        let client = PacePushAPIClient(baseURL: baseURL, token: nil)
        let exchange = try await client.exchangeDevicePairing(
            code: pairing.code,
            platform: "ios",
            label: UIDevice.current.name,
        )
        try keychain.saveString(exchange.token, account: tokenKey)
        deviceToken = exchange.token

        if pairing.baseURL != nil {
            apiBaseURL = baseURL.absoluteString.trimmedTrailingSlash
        }

        if shouldSyncPublicLeaderboardPreference {
            try? await savePublicLeaderboardPreference(
                preferredPublicLeaderboard,
                baseURL: baseURL,
                token: exchange.token,
            )
        }
        await refresh()
    }
}

final class PacePushAPIClient {
    let baseURL: URL
    let token: String?

    init(baseURL: URL, token: String?) {
        self.baseURL = baseURL
        self.token = token
    }

    func mobileGitHubStartURL(platform: String, label: String, callbackScheme: String) throws -> URL {
        var components = URLComponents(url: url("/api/mobile/auth/github/start"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "platform", value: platform),
            URLQueryItem(name: "label", value: label),
            URLQueryItem(name: "callbackScheme", value: callbackScheme),
        ]
        guard let url = components?.url else { throw PacePushAPIError.invalidURL }
        return url
    }

    func exchangeDevicePairing(code: String, platform: String, label: String) async throws -> DeviceExchangeResponse {
        try await post(
            "/api/mobile/devices",
            body: DevicePairingExchangeRequest(code: code, platform: platform, label: label),
            authenticated: false,
        )
    }

    func fetch<T: Decodable>(_ path: String, authenticated: Bool) async throws -> T {
        var request = URLRequest(url: url(path))
        request.setValue("application/json", forHTTPHeaderField: "accept")
        if authenticated {
            try authorize(&request)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(T.self, from: data)
    }

    func post<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body,
        authenticated: Bool,
    ) async throws -> Response {
        var request = URLRequest(url: url(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "accept")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        if authenticated {
            try authorize(&request)
        }
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(Response.self, from: data)
    }

    func patch<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body,
        authenticated: Bool,
    ) async throws -> Response {
        var request = URLRequest(url: url(path))
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "accept")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        if authenticated {
            try authorize(&request)
        }
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(Response.self, from: data)
    }

    func uploadDistanceDays(_ days: [HealthKitDistanceDay]) async throws -> DistanceDaysResponse {
        try await post(
            "/api/mobile/distance-days",
            body: DistanceDaysRequest(days: days),
            authenticated: true,
        )
    }

    func recordSyncRun(_ run: SyncRunRequest) async throws {
        let _: SyncRunResponse = try await post(
            "/api/mobile/sync-runs",
            body: run,
            authenticated: true,
        )
    }

    func url(_ path: String) -> URL {
        baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
    }

    private func authorize(_ request: inout URLRequest) throws {
        guard let token else { throw PacePushAPIError.unauthorized }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        if http.statusCode == 401 {
            throw PacePushAPIError.unauthorized
        }
        guard (200..<300).contains(http.statusCode) else {
            if let error = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                throw PacePushAPIError.server(error.error)
            }
            throw PacePushAPIError.server("Request failed with status \(http.statusCode).")
        }
    }
}

final class GitHubAuthSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?
    private var continuation: CheckedContinuation<URL, Error>?

    func authenticate(startURL: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let session = ASWebAuthenticationSession(
                url: startURL,
                callbackURLScheme: callbackScheme,
            ) { callbackURL, error in
                if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: error ?? PacePushAPIError.invalidCallback)
                }
                self.continuation = nil
                self.session = nil
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                continuation.resume(throwing: PacePushAPIError.invalidCallback)
                self.continuation = nil
                self.session = nil
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            if let window = windowScene.windows.first(where: { $0.isKeyWindow }) {
                return window
            }
        }
        return ASPresentationAnchor()
    }
}

struct KeychainStore {
    let service: String

    func saveString(_ value: String, account: String) throws {
        let data = Data(value.utf8)
        try delete(account: account)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData as String: data,
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw PacePushAPIError.keychain(status) }
    }

    func readString(account: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw PacePushAPIError.keychain(status) }
        guard let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func delete(account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let status = SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            throw PacePushAPIError.keychain(status)
        }
    }
}

enum PacePushAPIError: LocalizedError {
    case invalidURL
    case invalidCallback
    case invalidPairingCode
    case unauthorized
    case server(String)
    case keychain(OSStatus)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Could not build the request URL."
        case .invalidCallback:
            return "GitHub sign-in did not return a valid callback."
        case .invalidPairingCode:
            return "This QR code is not a valid Pace & Push pairing code."
        case .unauthorized:
            return "This device is not authorized."
        case .server(let message):
            return message
        case .keychain(let status):
            return "Keychain failed with status \(status)."
        }
    }
}

struct PairingPayload {
    let code: String
    let baseURL: URL?
}

enum PairingPayloadParser {
    static func parse(_ payload: String, apiBaseURL: URL?, callbackScheme: String) -> PairingPayload? {
        let trimmed = payload.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if trimmed.hasPrefix("pp_pair.") {
            return PairingPayload(code: trimmed, baseURL: nil)
        }

        guard let url = URL(string: trimmed),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let code = components.queryItems?.first(where: { $0.name == "code" })?.value,
              !code.isEmpty
        else {
            return nil
        }

        if isCustomSchemePairingURL(url, callbackScheme: callbackScheme) {
            return PairingPayload(code: code, baseURL: baseURLQueryItem(in: components, apiBaseURL: apiBaseURL))
        }

        if isWebPairingURL(url, apiBaseURL: apiBaseURL),
           let origin = originURL(for: url)
        {
            return PairingPayload(code: code, baseURL: origin)
        }

        return nil
    }

    static func isPairingURL(_ url: URL, apiBaseURL: URL?, callbackScheme: String) -> Bool {
        isCustomSchemePairingURL(url, callbackScheme: callbackScheme) || isWebPairingURL(url, apiBaseURL: apiBaseURL)
    }

    private static func isCustomSchemePairingURL(_ url: URL, callbackScheme: String) -> Bool {
        guard url.scheme?.lowercased() == callbackScheme.lowercased() else { return false }

        if url.host?.lowercased() == "pair" {
            return true
        }

        return url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")).lowercased() == "pair"
    }

    private static func isWebPairingURL(_ url: URL, apiBaseURL: URL?) -> Bool {
        guard let scheme = url.scheme?.lowercased(),
              let host = url.host?.lowercased(),
              url.normalizedPath == "/mobile/pair"
        else {
            return false
        }

        let expectedHost = apiBaseURL?.host?.lowercased()
        let expectedScheme = apiBaseURL?.scheme?.lowercased()
        let isKnownHost = host == "paceandpush.com" || host == expectedHost
        let isAllowedScheme = scheme == "https" || (host == expectedHost && scheme == expectedScheme)

        return isKnownHost && isAllowedScheme
    }

    private static func originURL(for url: URL) -> URL? {
        guard let scheme = url.scheme, let host = url.host else { return nil }

        var components = URLComponents()
        components.scheme = scheme
        components.host = host
        components.port = url.port
        return components.url
    }

    private static func baseURLQueryItem(in components: URLComponents, apiBaseURL: URL?) -> URL? {
        guard let value = components.queryItems?.first(where: { $0.name == "baseUrl" })?.value,
              let url = URL(string: value),
              let origin = originURL(for: url),
              isAllowedBaseURL(origin, apiBaseURL: apiBaseURL)
        else {
            return nil
        }

        return origin
    }

    private static func isAllowedBaseURL(_ url: URL, apiBaseURL: URL?) -> Bool {
        guard let scheme = url.scheme?.lowercased(),
              let host = url.host?.lowercased()
        else {
            return false
        }

        let expectedHost = apiBaseURL?.host?.lowercased()
        let isKnownHost = host == "paceandpush.com" || host == expectedHost
        let isLocalhost = host == "localhost" || host == "127.0.0.1"

        return (scheme == "https" && isKnownHost) || ((scheme == "http" || scheme == "https") && isLocalhost)
    }
}

enum DistanceUnits: String, CaseIterable, Identifiable {
    case metric
    case imperial

    var id: String { rawValue }

    var title: String {
        switch self {
        case .metric:
            return "Kilometers"
        case .imperial:
            return "Miles"
        }
    }

    var abbreviation: String {
        switch self {
        case .metric:
            return "km"
        case .imperial:
            return "mi"
        }
    }

    func format(_ kilometers: Double, includeUnit: Bool = false) -> String {
        let value = self == .imperial ? kilometers * 0.621371 : kilometers
        let formatted = value.formatted(.number.precision(.fractionLength(1)))
        return includeUnit ? "\(formatted) \(abbreviation)" : formatted
    }
}

enum Board: String, CaseIterable, Decodable, Identifiable {
    case balanced
    case commits
    case distance

    var id: String { rawValue }

    var title: String {
        switch self {
        case .balanced:
            return "Balanced"
        case .commits:
            return "Commits"
        case .distance:
            return "Run"
        }
    }
}

struct APIErrorResponse: Decodable {
    let error: String
}

struct MobileAuthExchangeRequest: Encodable {
    let code: String
}

struct DevicePairingExchangeRequest: Encodable {
    let code: String
    let platform: String
    let label: String
}

struct DeviceExchangeResponse: Decodable {
    let device: MobileDeviceSummary
    let token: String
}

struct MobileDeviceSummary: Decodable, Identifiable {
    let id: String
    let platform: String
    let label: String
    let lastSeenAt: String?
    let revoked: Bool
}

struct DistanceDaysRequest: Encodable {
    let days: [HealthKitDistanceDay]
}

struct DistanceDaysResponse: Decodable {
    let accepted: Int
    let flagged: Int
}

struct SyncRunRequest: Encodable {
    let platform: String
    let status: String
    let startedAt: String
    let finishedAt: String?
    let counters: [String: Int]
    let errorSummary: String?
}

struct SyncRunResponse: Decodable {
    let id: String
    let status: String
}

struct AccountSettingsRequest: Encodable {
    let publicLeaderboard: Bool?
    let units: String?
}

struct AccountSettingsResponse: Decodable {
    let login: String
    let displayName: String
    let publicLeaderboard: Bool
    let units: String
}

struct LeaderboardResponse: Decodable {
    let period: String
    let board: Board
    let rows: [LeaderboardRow]

    static let seed = LeaderboardResponse(
        period: "2026-07",
        board: .balanced,
        rows: []
    )
}

struct LeaderboardRow: Decodable, Identifiable {
    let rank: Int
    let login: String
    let displayName: String
    let score: Double
    let commits: Int
    let kilometers: Double
    let streakDays: Int

    var id: String { login }
}

struct MeResponse: Decodable {
    let login: String
    let displayName: String
    let publicLeaderboard: Bool
    let units: String
    let score: ScoreSummary
    let devices: [MobileDeviceSummary]

    static let seed = MeResponse(
        login: "guest",
        displayName: "Guest",
        publicLeaderboard: false,
        units: "metric",
        score: ScoreSummary(period: "2026-07", score: 0, rank: nil, commits: 0, kilometers: 0, lastSyncAt: nil),
        devices: []
    )
}

struct PublicProfileResponse: Decodable {
    let login: String
    let displayName: String
    let bio: String?
    let score: ScoreSummary
    let history: [ProfileHistoryPoint]

    static let seed = PublicProfileResponse(
        login: "guest",
        displayName: "Guest",
        bio: nil,
        score: MeResponse.seed.score,
        history: []
    )
}

struct ScoreSummary: Decodable {
    let period: String
    let score: Double
    let rank: Int?
    let commits: Int
    let kilometers: Double
    let lastSyncAt: String?
}

struct ProfileHistoryPoint: Decodable, Identifiable {
    let date: String
    let commits: Int
    let kilometers: Double
    let score: Double

    var id: String { date }
}

enum Brand {
    private static let paperHex: UInt32 = 0xf8f2e6
    private static let inkHex: UInt32 = 0x211e1a
    private static let mutedHex: UInt32 = 0x5f5a51
    private static let orangeHex: UInt32 = 0xf97316
    private static let greenHex: UInt32 = 0x166534
    private static let redHex: UInt32 = 0xb42318
    private static let blueHex: UInt32 = 0x0b5cad

    static let paper = Color(hex: paperHex)
    static let ink = Color(hex: inkHex)
    static let muted = Color(hex: mutedHex)
    static let orange = Color(hex: orangeHex)
    static let green = Color(hex: greenHex)
    static let red = Color(hex: redHex)
    static let blue = Color(hex: blueHex)

    static let uiPaper = UIColor(hex: paperHex)
    static let uiInk = UIColor(hex: inkHex)
    static let uiMuted = UIColor(hex: mutedHex)
    static let uiOrange = UIColor(hex: orangeHex)
}

private enum BrandAppearance {
    static func apply() {
        let navigationBar = UINavigationBar.appearance()
        navigationBar.tintColor = Brand.uiInk
        navigationBar.barTintColor = Brand.uiPaper
        navigationBar.backgroundColor = Brand.uiPaper
        navigationBar.titleTextAttributes = [.foregroundColor: Brand.uiInk]
        navigationBar.largeTitleTextAttributes = [.foregroundColor: Brand.uiInk]

        let tabBar = UITabBar.appearance()
        tabBar.tintColor = Brand.uiInk
        tabBar.unselectedItemTintColor = Brand.uiMuted
        tabBar.barTintColor = Brand.uiPaper
        tabBar.backgroundColor = Brand.uiPaper

        let segmentedControl = UISegmentedControl.appearance()
        segmentedControl.selectedSegmentTintColor = Brand.uiOrange
        segmentedControl.setTitleTextAttributes([.foregroundColor: Brand.uiInk], for: .normal)
        segmentedControl.setTitleTextAttributes([.foregroundColor: Brand.uiInk], for: .selected)

        UITableView.appearance().backgroundColor = Brand.uiPaper
        UITextField.appearance().textColor = Brand.uiInk
        UITextField.appearance().tintColor = Brand.uiInk
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .foregroundStyle(Brand.ink)
            .padding(14)
            .background(configuration.isPressed ? Brand.orange.opacity(0.72) : Brand.orange)
            .overlay(Rectangle().stroke(Brand.ink, lineWidth: 2))
    }
}

extension Date {
    var isoString: String {
        ISO8601DateFormatter.pacePush.string(from: self)
    }
}

extension String {
    var trimmedTrailingSlash: String {
        var value = self
        while value.count > 1 && value.hasSuffix("/") {
            value.removeLast()
        }
        return value
    }
}

extension URL {
    var normalizedPath: String {
        let value = path.trimmedTrailingSlash
        return value.isEmpty ? "/" : value
    }
}

extension ISO8601DateFormatter {
    static let pacePush: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

extension View {
    func panelStyle() -> some View {
        padding(18)
            .background(Brand.paper)
            .overlay(Rectangle().stroke(Brand.ink, lineWidth: 2))
    }

    func borderedRow() -> some View {
        overlay(Rectangle().frame(height: 1).foregroundStyle(Brand.ink.opacity(0.22)), alignment: .bottom)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255
        )
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xff) / 255,
            green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255,
            alpha: 1
        )
    }
}
