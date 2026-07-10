import AuthenticationServices
import CryptoKit
import Foundation
import Security
import SwiftUI
import UIKit

@main
struct PacePushApp: App {
    @StateObject private var store: PacePushStore

    init() {
        _store = StateObject(wrappedValue: PacePushStore.launchStore())
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
        .preferredColorScheme(store.themePreference.colorScheme)
        .task {
            await store.bootstrap()
        }
    }
}

struct MainTabsView: View {
    var body: some View {
        TabView {
            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.square") }

            LeaderboardView()
                .tabItem { Label("Board", systemImage: "list.number") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .accessibilityIdentifier("main-tabs")
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
                        ScoreExplanationDisclosure()
                    }
                    .panelStyle()

                    DemoEntryPanel()

                    OnboardingStep(
                        index: 1,
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
                        .accessibilityIdentifier("public-leaderboard-toggle")
                        .disabled(store.busy)

                        if !store.publicLeaderboardPreferenceChosen {
                            Button {
                                Task { await store.confirmPublicLeaderboardPreference() }
                            } label: {
                                Label(
                                    store.publicLeaderboardPreference ? "Use Public Leaderboard" : "Keep Score Private",
                                    systemImage: store.publicLeaderboardPreference ? "eye.square" : "eye.slash",
                                )
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(PrimaryButtonStyle())
                            .accessibilityIdentifier("confirm-public-leaderboard-button")
                            .disabled(store.busy)
                        }
                    }

                    OnboardingStep(
                        index: 2,
                        title: "Connect GitHub",
                        detail: store.githubOnboardingStatus,
                        complete: store.isGitHubConnected,
                    ) {
                        Button {
                            Task { await store.connectGitHub() }
                        } label: {
                            Label("Connect GitHub", systemImage: "chevron.right.square")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .accessibilityIdentifier("connect-github-button")
                        .disabled(store.busy || !store.publicLeaderboardPreferenceChosen)
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
                        .accessibilityIdentifier("enable-health-button")
                        .disabled(store.busy)
                    }

                    if let error = store.lastError {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(error)
                                .font(.callout.weight(.semibold))
                                .foregroundStyle(Brand.red)

                            if store.canRetryFirstSync {
                                Button {
                                    Task { await store.syncRunningDistance() }
                                } label: {
                                    Label("Try Sync Again", systemImage: "arrow.triangle.2.circlepath")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(PrimaryButtonStyle())
                                .accessibilityIdentifier("retry-sync-button")
                            }
                        }
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
            .accessibilityIdentifier("onboarding-view")
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
                    .roundedBackground(complete ? Brand.green.opacity(0.18) : Brand.orange)
                    .roundedBorder()

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
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if store.isDemoMode {
                        DemoExitBanner()
                    }

                    ScorePeriodSelector(activePeriod: store.activePeriod) { period in
                        Task { await store.setActivePeriod(period, board: board) }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        LeaderboardSearchField(searchText: $searchText)
                        BoardSelector(board: $board)
                        if board == .balanced {
                            ScoreExplanationDisclosure()
                        }

                        if !store.publicLeaderboardPreference {
                            LeaderboardPrivacyNotice()
                        }
                    }

                    VStack(alignment: .leading, spacing: 0) {
                        LeaderboardTableHeader(board: board, units: store.units)

                        if rows.isEmpty {
                            Text(emptyMessage)
                                .font(.callout.weight(.semibold))
                                .foregroundStyle(Brand.muted)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 18)
                                .borderedRow()
                        }

                        ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                            NavigationLink {
                                PublicProfileView(login: row.login)
                            } label: {
                                LeaderboardRowView(
                                    rank: index + 1,
                                    row: row,
                                    board: board,
                                    units: store.units,
                                    isCurrentUser: store.isCurrentUser(row)
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("leaderboard-row-\(row.login.lowercased())")
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
            .accessibilityIdentifier("leaderboard-screen")
            .background(Brand.paper)
            .foregroundStyle(Brand.ink)
            .toolbar(.hidden, for: .navigationBar)
            .refreshable {
                await store.refresh(board: board)
            }
            .task(id: board) {
                await store.refreshLeaderboard(board: board)
            }
        }
    }
}

struct LeaderboardPrivacyNotice: View {
    private let message = "Your score is private. Select Public leaderboard in Settings to appear on this leaderboard."

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "eye.slash")
                .font(.headline.weight(.bold))
                .foregroundStyle(Brand.orange)
                .accessibilityHidden(true)

            Text(message)
                .font(.callout.weight(.semibold))
                .foregroundStyle(Brand.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .roundedBackground(Brand.surfacePanelHigh)
        .roundedBorder(Brand.orange.opacity(0.55), lineWidth: 1)
        .accessibilityIdentifier("private-leaderboard-notice")
    }
}

struct ProfileView: View {
    @EnvironmentObject private var store: PacePushStore

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                if store.accountContentError == nil, store.shouldShowAccountLoading {
                    ScrollView {
                        AccountSetupLoadingPanel(
                            title: store.accountLoadingTitle,
                            message: store.accountLoadingMessage,
                            detail: store.accountLoadingDetail,
                            phase: store.accountLoadPhase,
                        )
                        .padding(.horizontal, 20)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: geometry.size.height, alignment: .center)
                    }
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            if store.isDemoMode {
                                DemoExitBanner()
                            }

                            if let error = store.accountContentError {
                                ProfileErrorPanel(message: error) {
                                    Task { await store.refresh() }
                                }
                            } else {
                                ProfileContentView(
                                    profile: store.profile,
                                    activePeriod: store.activePeriod,
                                    units: store.units,
                                    emptyHistoryMessage: "Sync running data to build your profile history."
                                ) { period in
                                    Task { await store.setActivePeriod(period) }
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 8)
                        .padding(.bottom, 20)

                        if !store.shouldShowAccountLoading,
                           store.accountContentError == nil,
                           let shareURL = store.shareProfileURL {
                            ShareLink(item: shareURL) {
                                Label("Share Profile", systemImage: "square.and.arrow.up")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(PrimaryButtonStyle())
                            .accessibilityIdentifier("share-profile-button")
                            .padding(.horizontal, 20)
                            .padding(.bottom, 20)
                        }
                    }
                }
            }
            .accessibilityIdentifier("profile-screen")
            .background(Brand.paper)
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

struct PublicProfileView: View {
    @EnvironmentObject private var store: PacePushStore
    let login: String
    @State private var activePeriod: ScorePeriod?
    @State private var profile: PublicProfileResponse?
    @State private var isLoading = false
    @State private var errorMessage: String?

    private var selectedPeriod: ScorePeriod {
        activePeriod ?? store.activePeriod
    }

    var body: some View {
        ScrollView {
            Group {
                if let profile {
                    ProfileContentView(
                        profile: profile,
                        activePeriod: selectedPeriod,
                        units: store.units,
                        emptyHistoryMessage: "No profile history for this period yet."
                    ) { period in
                        activePeriod = period
                    }
                } else if isLoading {
                    LoadingPanel(message: "Loading profile...")
                } else {
                    ProfileErrorPanel(message: errorMessage ?? "Profile could not be loaded.") {
                        Task { await loadProfile(period: selectedPeriod) }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 20)
        }
        .accessibilityIdentifier("public-profile-screen")
        .background(Brand.paper)
        .navigationTitle("@\(login)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .task(id: selectedPeriod.rawValue) {
            await loadProfile(period: selectedPeriod)
        }
        .refreshable {
            await loadProfile(period: selectedPeriod)
        }
    }

    @MainActor
    private func loadProfile(period: ScorePeriod) async {
        isLoading = true
        errorMessage = nil

        do {
            profile = try await store.fetchPublicProfile(login: login, period: period)
        } catch {
            profile = nil
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

struct ProfileContentView: View {
    let profile: PublicProfileResponse
    let activePeriod: ScorePeriod
    let units: DistanceUnits
    let emptyHistoryMessage: String
    let onSelectPeriod: (ScorePeriod) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ScorePeriodSelector(activePeriod: activePeriod, onSelect: onSelectPeriod)

            VStack(alignment: .leading, spacing: 12) {
                Text("@\(profile.login)")
                    .font(.title.bold())
                if let bio = profile.bio?.trimmingCharacters(in: .whitespacesAndNewlines), !bio.isEmpty {
                    Text(bio)
                        .foregroundStyle(Brand.muted)
                }

                HStack(spacing: 12) {
                    MetricTile(
                        title: "Score",
                        value: profile.score.score.formatted(.number.precision(.fractionLength(1))),
                        color: Brand.orange,
                        valueAccessibilityIdentifier: "profile-score-value"
                    )
                    MetricTile(
                        title: "Commits",
                        value: "\(profile.score.commits)",
                        color: Brand.green,
                        valueAccessibilityIdentifier: "profile-commits-value"
                    )
                }

                HStack(spacing: 12) {
                    MetricTile(
                        title: units.title,
                        value: units.format(profile.score.kilometers),
                        color: Brand.blue,
                        valueAccessibilityIdentifier: "profile-distance-value"
                    )
                    MetricTile(
                        title: "Rank",
                        value: profile.score.rank.map { "#\($0)" } ?? "-",
                        color: Brand.ink
                    )
                }

                ScoreExplanationDisclosure()
                ProfileChartView(history: profile.history, units: units)

                if profile.history.isEmpty {
                    Text(emptyHistoryMessage)
                        .foregroundStyle(Brand.muted)
                } else {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("\(activePeriod.shortLabel) history")
                            .font(.headline.weight(.black))
                            .padding(.top, 4)

                        ForEach(profile.history) { point in
                            HStack {
                                Text(point.date)
                                    .font(.system(.body, design: .monospaced))
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text(point.score.formatted(.number.precision(.fractionLength(1))))
                                        .foregroundStyle(Brand.orange)
                                        .fontWeight(.bold)
                                    Text(units.format(point.kilometers, includeUnit: true))
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(Brand.blue)
                                }
                            }
                            .padding(.vertical, 8)
                            .borderedRow()
                        }
                    }
                }
            }
            .panelStyle()
        }
    }
}

struct LoadingPanel: View {
    let message: String

    var body: some View {
        HStack(spacing: 12) {
            ProgressView()
            Text(message)
                .font(.headline.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .panelStyle()
    }
}

struct AccountSetupLoadingPanel: View {
    let title: String
    let message: String
    let detail: String
    let phase: AccountLoadPhase

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title2.weight(.black))
                Text(message)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(Brand.orange)
            }

            AccountSetupProgressBar(
                targetProgress: phase.progressValue,
                accessibilityValue: phase.progressAccessibilityValue
            )

            Text(detail)
                .font(.callout.weight(.semibold))
                .foregroundStyle(Brand.muted)

            VStack(alignment: .leading, spacing: 8) {
                ForEach(phase.setupSteps) { step in
                    SetupProgressRow(step: step)
                }
            }
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .panelStyle()
        .accessibilityIdentifier("account-loading-panel")
    }
}

struct AccountSetupProgressBar: View {
    let targetProgress: Double
    let accessibilityValue: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var displayedProgress = 0.08
    @State private var shimmerOffset = -0.35

    var body: some View {
        GeometryReader { geometry in
            let width = max(geometry.size.width, 1)
            let fillWidth = max(8, width * min(max(displayedProgress, 0), 0.96))

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Brand.line.opacity(0.85))

                Capsule()
                    .fill(Brand.orange)
                    .frame(width: fillWidth)

                if !reduceMotion {
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0),
                                    Color.white.opacity(0.42),
                                    Color.white.opacity(0),
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: width * 0.28)
                        .offset(x: shimmerOffset * width)
                        .mask(Capsule())
                }
            }
        }
        .frame(height: 6)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Account setup progress")
        .accessibilityValue(accessibilityValue)
        .onAppear {
            let shouldAnimate = shouldAnimateAccountLoading
            displayedProgress = shouldAnimate ? max(0.08, min(targetProgress - 0.12, targetProgress)) : targetProgress
            withAnimation(.easeOut(duration: shouldAnimate ? 0.9 : 0.01)) {
                displayedProgress = targetProgress
            }
            startShimmer()
        }
        .onChange(of: targetProgress) { _, newValue in
            withAnimation(.easeOut(duration: shouldAnimateAccountLoading ? 0.55 : 0.01)) {
                displayedProgress = max(displayedProgress, newValue)
            }
        }
    }

    private func startShimmer() {
        guard shouldAnimateAccountLoading else { return }
        shimmerOffset = -0.35
        withAnimation(.linear(duration: 1.25).repeatForever(autoreverses: false)) {
            shimmerOffset = 1.1
        }
    }

    private var shouldAnimateAccountLoading: Bool {
        !reduceMotion && !isRunningUITests
    }
}

struct SetupProgressRow: View {
    let step: AccountSetupStepStatus

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isSpinning = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: iconName)
                .foregroundStyle(step.state == .complete ? Brand.green : step.state == .active ? Brand.orange : Brand.muted)
                .rotationEffect(step.state == .active && shouldAnimateAccountLoading ? .degrees(isSpinning ? 360 : 0) : .zero)
                .animation(
                    step.state == .active && shouldAnimateAccountLoading
                        ? .linear(duration: 1.15).repeatForever(autoreverses: false)
                        : .default,
                    value: isSpinning
                )
                .accessibilityHidden(true)
            Text(step.label)
                .font(.callout.weight(.semibold))
                .foregroundStyle(step.state == .active ? Brand.ink : Brand.muted)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(step.label), \(step.state.accessibilityLabel)")
        .onAppear {
            if step.state == .active {
                isSpinning = true
            }
        }
        .onChange(of: step.state) { _, newState in
            isSpinning = newState == .active
        }
    }

    private var iconName: String {
        switch step.state {
        case .pending:
            return "circle"
        case .active:
            return "arrow.triangle.2.circlepath.circle"
        case .complete:
            return "checkmark.circle.fill"
        }
    }

    private var shouldAnimateAccountLoading: Bool {
        !reduceMotion && !isRunningUITests
    }
}

private var isRunningUITests: Bool {
    ProcessInfo.processInfo.arguments.contains { $0.hasPrefix("-uiTesting") }
}

struct ProfileErrorPanel: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(message)
                .font(.headline.weight(.semibold))
                .foregroundStyle(Brand.red)
            Button("Retry", action: retry)
                .buttonStyle(PrimaryButtonStyle())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .panelStyle()
    }
}

struct SettingsView: View {
    @EnvironmentObject private var store: PacePushStore
    @State private var isServerSettingsExpanded = false
    @State private var isSignOutConfirmationPresented = false
    @State private var isDeleteAccountConfirmationPresented = false
    @State private var accountExportItem: AccountExportItem?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if store.isDemoMode {
                        DemoExitBanner()
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Settings")
                            .font(.title.bold())
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .panelStyle()

                    SettingsSectionPanel("Theme") {
                        SettingsThemeSelector(themePreference: $store.themePreference)
                    }

                    SettingsSectionPanel("Sync") {
                        StatusRow(
                            label: "GitHub",
                            value: store.githubConnectionStatus,
                        )
                        if store.isDemoMode {
                            EmptyView()
                        } else if store.isGitHubConnected {
                            SettingsActionButton(
                                "Sign out",
                                systemImage: "rectangle.portrait.and.arrow.right",
                                tone: .danger,
                                isDisabled: store.busy,
                            ) {
                                isSignOutConfirmationPresented = true
                            }
                            .accessibilityIdentifier("settings-sign-out-button")
                        } else {
                            SettingsActionButton(
                                "Connect GitHub",
                                systemImage: "chevron.right.square",
                                tone: .primary,
                                isDisabled: store.busy,
                            ) {
                                Task { await store.connectGitHub() }
                            }
                            .accessibilityIdentifier("settings-connect-github-button")
                        }

                        StatusRow(label: "Apple Health", value: store.isDemoMode ? "Demo data" : store.healthAuthorized ? "Enabled" : "Needs permission")
                        if !store.isDemoMode && !store.healthAuthorized {
                            SettingsActionButton(
                                "Enable Health",
                                systemImage: "heart.text.square",
                                tone: .primary,
                                isDisabled: store.busy,
                            ) {
                                Task { await store.requestHealthAccess() }
                            }
                            .accessibilityIdentifier("settings-enable-health-button")
                        }

                        StatusRow(label: "Last sync", value: store.lastSyncStatus)
                        if !store.isDemoMode {
                            SettingsActionButton(
                                store.syncActionTitle,
                                systemImage: "arrow.triangle.2.circlepath",
                                tone: .primary,
                                isDisabled: store.busy || !store.healthAuthorized || !store.isGitHubConnected,
                            ) {
                                Task { await store.syncRunningDistance() }
                            }
                            .accessibilityIdentifier("sync-now-button")
                        }

                        if let error = store.lastError {
                            Text(error)
                                .font(.callout.weight(.semibold))
                                .foregroundStyle(Brand.red)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                                .roundedBackground(Brand.surfacePanelHigh)
                                .roundedBorder(lineWidth: 1)
                        }
                    }

                    SettingsSectionPanel("Units") {
                        SettingsUnitSelector(units: $store.units)
                    }

                    SettingsSectionPanel("Privacy") {
                        HStack(spacing: 16) {
                            Text("Public leaderboard")
                                .foregroundStyle(Brand.ink)
                                .fontWeight(.semibold)
                            Spacer()
                            Toggle(
                                "Public leaderboard",
                                isOn: Binding(
                                    get: { store.publicLeaderboardPreference },
                                    set: { value in
                                        Task { await store.setPublicLeaderboardPreference(value) }
                                    },
                                ),
                            )
                            .labelsHidden()
                            .tint(Brand.orange)
                            .accessibilityIdentifier("settings-public-leaderboard-toggle")
                            .disabled(store.busy)
                        }
                        .padding(.vertical, 12)
                        .borderedRow()

                        Text("Running distance summaries are synced by day. Raw workouts and routes are not uploaded.")
                            .font(.callout.weight(.semibold))
                            .foregroundStyle(Brand.muted)
                            .padding(.top, 2)

                        SettingsLinkButton(
                            "Privacy Policy",
                            systemImage: "hand.raised",
                            destination: SupportLinks.privacyPolicyURL,
                        )
                        .accessibilityIdentifier("settings-privacy-policy-link")

                        if store.isGitHubConnected {
                            SettingsActionButton(
                                "Export data",
                                systemImage: "square.and.arrow.up",
                                isDisabled: store.busy,
                            ) {
                                Task {
                                    accountExportItem = await store.exportAccountData()
                                }
                            }
                            .accessibilityIdentifier("settings-export-data-button")

                            SettingsActionButton(
                                "Delete account",
                                systemImage: "trash",
                                tone: .danger,
                                isDisabled: store.busy,
                            ) {
                                isDeleteAccountConfirmationPresented = true
                            }
                            .accessibilityIdentifier("settings-delete-account-button")
                        }
                    }

                    if store.showsServerSettings {
                        SettingsSectionPanel("Advanced") {
                            SettingsActionButton(
                                "Server",
                                systemImage: isServerSettingsExpanded ? "chevron.up" : "chevron.down",
                            ) {
                                withAnimation(.snappy) {
                                    isServerSettingsExpanded.toggle()
                                }
                            }
                            .accessibilityLabel("Server")
                            .accessibilityIdentifier("advanced-server-disclosure")

                            if isServerSettingsExpanded {
                                TextField("API base URL", text: $store.apiBaseURL)
                                    .font(Font.system(.body, design: .monospaced))
                                    .foregroundStyle(Brand.ink)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .padding(12)
                                    .roundedBackground(Brand.surfacePanelHigh)
                                    .roundedBorder(lineWidth: 1)
                                    .accessibilityIdentifier("api-base-url-field")
                            }
                        }
                    } else {
                        SettingsSectionPanel("Server") {
                            StatusRow(label: "API", value: "paceandpush.com")
                        }
                    }

                    SettingsSectionPanel("Support") {
                        SettingsLinkButton("Beta feedback", systemImage: "envelope", destination: SupportLinks.feedbackURL)
                            .accessibilityIdentifier("beta-feedback-link")
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
            .accessibilityIdentifier("settings-screen")
            .background(Brand.paper)
            .foregroundStyle(Brand.ink)
            .toolbar(.hidden, for: .navigationBar)
            .confirmationDialog(
                "Sign out?",
                isPresented: $isSignOutConfirmationPresented,
                titleVisibility: .visible,
            ) {
                Button("Sign out", role: .destructive) {
                    Task { await store.disconnectGitHub() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Pace & Push will stop GitHub contribution access and clear this device connection.")
            }
            .confirmationDialog(
                "Delete account?",
                isPresented: $isDeleteAccountConfirmationPresented,
                titleVisibility: .visible,
            ) {
                Button("Delete account", role: .destructive) {
                    Task { await store.deleteAccount() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This removes your Pace & Push account, connected devices, score history, and synced distance totals.")
            }
            .sheet(item: $accountExportItem) { item in
                AccountExportShareSheet(activityItems: [item.text])
            }
        }
    }
}

struct AccountExportItem: Identifiable {
    let id = UUID()
    let text: String
}

struct AccountExportShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

struct SettingsSectionPanel<Content: View>: View {
    let title: String
    let detail: String?
    let content: () -> Content

    init(_ title: String, detail: String? = nil, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.detail = detail
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline.weight(.black))
                if let detail {
                    Text(detail)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(Brand.muted)
                }
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .panelStyle()
    }
}

struct StatusRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 16) {
            Text(label)
                .foregroundStyle(Brand.muted)
                .fontWeight(.semibold)
            Spacer()
            Text(value)
                .font(.body.monospaced().weight(.bold))
                .multilineTextAlignment(.trailing)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 12)
        .borderedRow()
    }
}

enum SettingsActionTone {
    case neutral
    case primary
    case danger
}

struct SettingsActionButton: View {
    let title: String
    let systemImage: String
    let tone: SettingsActionTone
    let isDisabled: Bool
    let action: () -> Void

    init(
        _ title: String,
        systemImage: String,
        tone: SettingsActionTone = .neutral,
        isDisabled: Bool = false,
        action: @escaping () -> Void,
    ) {
        self.title = title
        self.systemImage = systemImage
        self.tone = tone
        self.isDisabled = isDisabled
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(foreground)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 12)
                .padding(.horizontal, 12)
                .roundedBackground(background)
                .roundedBorder()
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.56 : 1)
    }

    private var foreground: Color {
        switch tone {
        case .neutral, .primary:
            return Brand.ink
        case .danger:
            return Brand.red
        }
    }

    private var background: Color {
        switch tone {
        case .neutral, .danger:
            return Brand.surfacePanelHigh
        case .primary:
            return Brand.orange
        }
    }

}

struct SettingsLinkButton: View {
    let title: String
    let systemImage: String
    let destination: URL

    init(_ title: String, systemImage: String, destination: URL) {
        self.title = title
        self.systemImage = systemImage
        self.destination = destination
    }

    var body: some View {
        Link(destination: destination) {
            Label(title, systemImage: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(Brand.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 12)
                .padding(.horizontal, 12)
                .roundedBackground(Brand.surfacePanelHigh)
                .roundedBorder(lineWidth: 1)
        }
    }
}

struct SettingsThemeSelector: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var themePreference: BrandThemePreference
    private let options: [BrandThemePreference] = [.light, .dark]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options) { option in
                let isSelected = option == selectedOption
                Button {
                    themePreference = option
                } label: {
                    Text(option.title)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(Brand.ink)
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .background(isSelected ? Brand.orange : Brand.surfacePanelHigh)
                }
                .accessibilityIdentifier("settings-theme-\(option.id)-button")
                .accessibilityLabel(option.title)
                .accessibilityValue(isSelected ? "Selected" : "Not selected")
                .accessibilityAddTraits(isSelected ? .isSelected : [])
                .buttonStyle(.plain)
                .overlay(alignment: .trailing) {
                    if option.id != options.last?.id {
                        Rectangle()
                            .frame(width: 1)
                            .foregroundStyle(Brand.line)
                    }
                }
            }
        }
        .roundedClip()
        .roundedBorder(lineWidth: 1)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("settings-theme-selector")
    }

    private var selectedOption: BrandThemePreference {
        switch themePreference {
        case .light, .dark:
            return themePreference
        case .system:
            return colorScheme == .dark ? .dark : .light
        }
    }
}

struct SettingsUnitSelector: View {
    @Binding var units: DistanceUnits

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Distance")
                .font(.caption.weight(.black))
                .foregroundStyle(Brand.muted)
                .textCase(.uppercase)
            HStack(spacing: 0) {
                ForEach(DistanceUnits.allCases) { option in
                    Button {
                        units = option
                    } label: {
                        Text(option.title)
                            .font(.headline.weight(.bold))
                            .foregroundStyle(Brand.ink)
                            .frame(maxWidth: .infinity, minHeight: 42)
                            .background(option == units ? Brand.orange : Brand.surfacePanelHigh)
                    }
                    .buttonStyle(.plain)
                    .overlay(alignment: .trailing) {
                        if option.id != DistanceUnits.allCases.last?.id {
                            Rectangle()
                                .frame(width: 1)
                                .foregroundStyle(Brand.line)
                        }
                    }
                }
            }
            .roundedClip()
            .roundedBorder(lineWidth: 1)
        }
    }
}

struct DemoEntryPanel: View {
    @EnvironmentObject private var store: PacePushStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                store.startDemoMode()
            } label: {
                Label("Try Demo", systemImage: "play.circle")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PrimaryButtonStyle())
            .accessibilityIdentifier("try-demo-button")
        }
        .panelStyle()
    }
}

struct DemoExitBanner: View {
    @EnvironmentObject private var store: PacePushStore

    var body: some View {
        Button {
            store.exitDemoMode()
        } label: {
            Label("Exit Demo", systemImage: "xmark.circle")
                .font(.callout.weight(.black))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
        }
        .buttonStyle(.plain)
        .foregroundStyle(Brand.ink)
        .roundedBackground(Brand.yellow.opacity(0.35))
        .roundedBorder(Brand.orange.opacity(0.55), lineWidth: 1.5)
        .accessibilityIdentifier("demo-exit-banner-button")
    }
}

struct HeaderView: View {
    var body: some View {
        HStack(spacing: 16) {
            Text(">")
                .font(.system(size: 34, weight: .black, design: .monospaced))
                .foregroundStyle(Brand.ink)
                .frame(width: 48, height: 48)
                .roundedBackground(Brand.orange)
                .roundedBorder()

            VStack(alignment: .leading, spacing: 2) {
                Text("Pace & Push")
                    .font(.title.bold())
                Text("Run. Commit. Repeat.")
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
    let valueAccessibilityIdentifier: String

    init(title: String, value: String, color: Color, valueAccessibilityIdentifier: String? = nil) {
        self.title = title
        self.value = value
        self.color = color
        self.valueAccessibilityIdentifier = valueAccessibilityIdentifier
            ?? "metric-\(title.lowercased().replacingOccurrences(of: " ", with: "-"))-value"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(Brand.muted)
                .textCase(.uppercase)
            Text(value)
                .font(.title.bold())
                .foregroundStyle(color)
                .accessibilityIdentifier(valueAccessibilityIdentifier)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .panelStyle(surface: Brand.surfacePanel, stroke: Brand.line, lineWidth: 1)
    }
}

enum ScoreExplanation {
    static let formula = "score = sqrt(commit ratio x running ratio) x 100"
    static let body = "Balanced score compares your commits and running distance with the strongest totals in the selected period. Each side becomes a 0-1 ratio, then the two ratios are combined with a geometric mean."
    static let note = "A zero on either side makes the score 0, so the balanced board rewards people who ship code and run."
}

enum SupportLinks {
    static let email = "hawigxyz@proton.me"
    static let feedbackURL = URL(string: "mailto:\(email)?subject=Pace%20%26%20Push%20beta%20feedback")!
    static let privacyPolicyURL = URL(string: "https://paceandpush.com/privacy")!

    static func publicProfileURL(login: String) -> URL? {
        guard let encodedLogin = login.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) else {
            return nil
        }

        return URL(string: "https://paceandpush.com/users/\(encodedLogin)")
    }
}

struct ScoreExplanationDisclosure: View {
    @State private var isExpanded = false

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            ScoreExplanationText()
                .padding(.top, 4)
        } label: {
            Label("How score works", systemImage: "questionmark.circle")
                .font(.callout.weight(.bold))
                .foregroundStyle(Brand.ink)
        }
        .padding(12)
        .roundedBackground(Brand.surfacePanelHigh)
        .roundedBorder(lineWidth: 1)
        .accessibilityIdentifier("score-explanation-disclosure")
    }
}

struct ScoreExplanationText: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(ScoreExplanation.body)
                .font(.callout)
                .foregroundStyle(Brand.muted)
            Text(ScoreExplanation.formula)
                .font(.system(.caption, design: .monospaced).weight(.bold))
                .foregroundStyle(Brand.ink)
                .padding(.vertical, 6)
                .padding(.horizontal, 8)
                .roundedBackground(Brand.orange.opacity(0.10))
            Text(ScoreExplanation.note)
                .font(.callout)
                .foregroundStyle(Brand.muted)
        }
        .accessibilityIdentifier("score-explanation-text")
    }
}

struct ScorePeriodSelector: View {
    let activePeriod: ScorePeriod
    let onSelect: (ScorePeriod) -> Void

    private var now: Date { Date() }
    private var previousPeriod: ScorePeriod { activePeriod.shifted(by: -1) }
    private var nextPeriod: ScorePeriod { activePeriod.shifted(by: 1) }
    private var options: [ScorePeriodOption] {
        ScorePeriodOption.options(for: activePeriod, now: now)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            PeriodKindSelector(activeKind: activePeriod.kind) { kind in
                onSelect(ScorePeriod(kind: kind, date: activePeriod.referenceDate(now: now)))
            }

            HStack(spacing: 10) {
                Button {
                    onSelect(previousPeriod)
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.headline.weight(.black))
                        .frame(width: 42, height: 42)
                        .roundedBackground(Brand.surfacePanelHigh)
                }
                .buttonStyle(.plain)
                .roundedBorder(lineWidth: 1)
                .accessibilityIdentifier("period-previous-button")

                Menu {
                    ForEach(options) { option in
                        Button {
                            onSelect(option.period)
                        } label: {
                            Text(option.menuLabel)
                        }
                        .disabled(option.disabled)
                    }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(activePeriod.kind.singularTitle)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Brand.muted)
                                .textCase(.uppercase)
                            Text(activePeriod.label)
                                .font(.headline.weight(.black))
                                .foregroundStyle(Brand.ink)
                        }
                        Spacer()
                        Image(systemName: "chevron.down")
                            .font(.caption.weight(.black))
                            .foregroundStyle(Brand.ink)
                    }
                    .padding(.horizontal, 12)
                    .frame(minHeight: 42)
                    .roundedBackground(Brand.surfacePanelHigh)
                    .roundedBorder(lineWidth: 1)
                }
                .accessibilityIdentifier("period-menu")

                Button {
                    onSelect(nextPeriod)
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.headline.weight(.black))
                        .frame(width: 42, height: 42)
                        .roundedBackground(Brand.surfacePanelHigh)
                }
                .buttonStyle(.plain)
                .roundedBorder(lineWidth: 1)
                .disabled(nextPeriod.isFuture(comparedTo: now))
                .accessibilityIdentifier("period-next-button")
            }
        }
        .padding(12)
        .roundedBackground(Brand.surfacePanel)
        .roundedBorder(lineWidth: 1)
        .accessibilityIdentifier("period-selector")
    }
}

struct PeriodKindSelector: View {
    let activeKind: ScorePeriodKind
    let onSelect: (ScorePeriodKind) -> Void

    var body: some View {
        HStack(spacing: 0) {
            ForEach(ScorePeriodKind.allCases) { kind in
                Button {
                    onSelect(kind)
                } label: {
                    Text(kind.title)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(Brand.ink)
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .background(kind == activeKind ? Brand.orange : Brand.surfacePanelHigh)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("period-kind-\(kind.rawValue)")
                .accessibilityAddTraits(kind == activeKind ? .isSelected : [])
                .overlay(alignment: .trailing) {
                    if kind.id != ScorePeriodKind.allCases.last?.id {
                        Rectangle()
                            .frame(width: 1)
                            .foregroundStyle(Brand.line)
                    }
                }
            }
        }
        .roundedClip()
        .roundedBorder(lineWidth: 1)
        .accessibilityIdentifier("period-kind-picker")
    }
}

struct ProfileChartView: View {
    let history: [ProfileHistoryPoint]
    let units: DistanceUnits

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Profile chart")
                    .font(.headline.weight(.black))
                Spacer()
                Text(historyLabel)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Brand.muted)
                    .textCase(.uppercase)
            }

            if history.isEmpty {
                Text("No chart data yet.")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(Brand.muted)
                    .frame(maxWidth: .infinity, minHeight: 176, alignment: .center)
                    .roundedBorder(lineWidth: 1)
            } else {
                GeometryReader { geometry in
                    ZStack {
                        chartGrid(in: geometry.size)
                            .stroke(Brand.line, lineWidth: 1)

                        ForEach(ProfileChartSeries.barSeries) { series in
                            barPath(for: series, in: geometry.size)
                                .fill(series.color.opacity(0.42))
                        }

                        linePath(for: .score, in: geometry.size)
                            .stroke(
                                ProfileChartSeries.score.color,
                                style: StrokeStyle(
                                    lineWidth: ProfileChartSeries.score.lineWidth,
                                    lineCap: .round,
                                    lineJoin: .round,
                                    dash: ProfileChartSeries.score.dash,
                                ),
                            )
                    }
                }
                .frame(height: 176)
                .padding(10)
                .roundedBackground(Brand.surfacePanel)
                .roundedBorder(lineWidth: 1)
                .accessibilityLabel("Score line with daily commit and running distance bars")

                HStack(spacing: 14) {
                    ForEach(ProfileChartSeries.allCases) { series in
                        HStack(spacing: 6) {
                            Circle()
                                .fill(series.color)
                                .frame(width: 8, height: 8)
                            Text(series.legendTitle(units: units))
                                .font(.caption.weight(.bold))
                                .foregroundStyle(series.color)
                        }
                    }
                }
            }
        }
        .accessibilityIdentifier("profile-chart")
    }

    private var historyLabel: String {
        guard let first = history.first?.date, let last = history.last?.date else {
            return "No points"
        }
        if first == last {
            return first
        }
        return "\(first) to \(last)"
    }

    private func chartGrid(in size: CGSize) -> Path {
        var path = Path()
        let rows = 4
        for row in 0...rows {
            let y = size.height * CGFloat(row) / CGFloat(rows)
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: size.width, y: y))
        }
        return path
    }

    private func barPath(for series: ProfileChartSeries, in size: CGSize) -> Path {
        let values = dailyValues(for: series)
        guard let maxValue = values.max(), maxValue > 0 else { return Path() }

        var path = Path()
        let usableWidth = max(size.width, 1)
        let usableHeight = max(size.height, 1)
        let count = max(values.count, 1)
        let slotWidth = usableWidth / CGFloat(count)
        let groupWidth = min(14, max(2, slotWidth * 0.74))
        let barWidth = max(1, groupWidth / 2)
        let offset = series == .commits ? CGFloat(0) : barWidth

        for (index, value) in values.enumerated() {
            let height = max(2, usableHeight * CGFloat(value / maxValue) * 0.52)
            let centerX = slotWidth * CGFloat(index) + slotWidth / 2
            let x = centerX - groupWidth / 2 + offset
            let y = usableHeight - height
            path.addRoundedRect(
                in: CGRect(x: x, y: y, width: barWidth, height: height),
                cornerSize: CGSize(width: 2, height: 2)
            )
        }

        return path
    }

    private func linePath(for series: ProfileChartSeries, in size: CGSize) -> Path {
        let values = history.map { series.value(from: $0) }
        guard let maxValue = values.max(), maxValue > 0 else { return Path() }

        var path = Path()
        let usableWidth = max(size.width, 1)
        let usableHeight = max(size.height, 1)
        let count = max(values.count - 1, 1)

        for (index, value) in values.enumerated() {
            let x = values.count == 1 ? usableWidth : usableWidth * CGFloat(index) / CGFloat(count)
            let y = usableHeight - (usableHeight * CGFloat(value / maxValue))
            let point = CGPoint(x: x, y: y)

            if index == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }

        return path
    }

    private func dailyValues(for series: ProfileChartSeries) -> [Double] {
        var previous = 0.0
        return history.map { point in
            let value = series.value(from: point)
            let delta = max(0, value - previous)
            previous = value
            return delta
        }
    }
}

struct LeaderboardSearchField: View {
    @Binding var searchText: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.headline.weight(.bold))
                .foregroundStyle(Brand.ink)

            TextField("Developer", text: $searchText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.headline.weight(.semibold))

            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.headline.weight(.semibold))
                }
                .buttonStyle(.plain)
                .foregroundStyle(Brand.muted)
            }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 44)
        .roundedBorder(lineWidth: 1)
    }
}

struct BoardSelector: View {
    @Binding var board: Board

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Board.allCases) { item in
                Button {
                    board = item
                } label: {
                    Text(item.title)
                        .font(.headline.weight(.bold))
                        .frame(maxWidth: .infinity, minHeight: 38)
                        .foregroundStyle(Brand.ink)
                        .background(item == board ? Brand.orange : Brand.surfacePanel)
                }
                .buttonStyle(.plain)
                .overlay(alignment: .trailing) {
                    if item != .distance {
                        Rectangle()
                            .frame(width: 1)
                            .foregroundStyle(Brand.line)
                    }
                }
            }
        }
        .roundedClip()
        .roundedBorder(lineWidth: 1)
    }
}

struct LeaderboardTableHeader: View {
    let board: Board
    let units: DistanceUnits

    var body: some View {
        HStack(spacing: 12) {
            Text("#")
                .frame(width: 38, alignment: .leading)
            Text("Developer")
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(board.leaderboardMetricTitle(units: units))
                .frame(width: 92, alignment: .trailing)
        }
        .font(.caption.weight(.black))
        .foregroundStyle(Brand.muted)
        .textCase(.uppercase)
        .padding(.vertical, 12)
        .borderedRow()
    }
}

struct LeaderboardRowView: View {
    let rank: Int
    let row: LeaderboardRow
    let board: Board
    let units: DistanceUnits
    let isCurrentUser: Bool

    private var metric: LeaderboardMetric {
        board.leaderboardMetric(for: row, units: units)
    }

    var body: some View {
        HStack(spacing: 12) {
            Text(String(format: "%02d", rank))
                .font(.system(.headline, design: .monospaced).weight(rank <= 3 ? .black : .regular))
                .frame(width: 38, height: 28, alignment: rank <= 3 ? .center : .leading)
                .roundedBackground(rank <= 3 ? Brand.yellow : Color.clear)
                .overlay {
                    if rank <= 3 {
                        RoundedRectangle(cornerRadius: Brand.cornerRadius).stroke(Brand.line, lineWidth: 1)
                    }
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(row.login)
                    .font(.headline.monospaced())
                Text(row.displayName)
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(metric.value)
                    .font(.headline.monospaced().weight(.bold))
                    .foregroundStyle(metric.color)
                if let detail = metric.detail {
                    Text(detail)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Brand.muted)
                }
            }
            .frame(width: 108, alignment: .trailing)
        }
        .padding(.vertical, 14)
        .padding(.horizontal, isCurrentUser ? 8 : 0)
        .background(isCurrentUser ? Brand.orange.opacity(0.08) : Color.clear)
        .borderedRow()
    }
}

protocol PacePushClienting {
    func mobileGitHubStartURL(platform: String, label: String, callbackScheme: String, codeChallenge: String) throws -> URL
    func exchangeMobileAuthCode(_ code: String, codeVerifier: String) async throws -> DeviceExchangeResponse
    func exchangeDevicePairing(code: String, platform: String, label: String) async throws -> DeviceExchangeResponse
    func disconnectGitHub() async throws -> GitHubDisconnectResponse
    func exportAccountData() async throws -> String
    func deleteAccount() async throws -> AccountDeletionResponse
    func fetchLeaderboard(board: Board, period: String) async throws -> LeaderboardResponse
    func fetchMe(period: String) async throws -> MeResponse
    func fetchProfile(period: String) async throws -> PublicProfileResponse
    func fetchPublicProfile(login: String, period: String) async throws -> PublicProfileResponse
    func updateSettings(publicLeaderboard: Bool?, units: String?) async throws -> AccountSettingsResponse
    func uploadDistanceDays(_ days: [HealthKitDistanceDay]) async throws -> DistanceDaysResponse
    func recordSyncRun(_ run: SyncRunRequest) async throws
}

protocol KeychainStoring {
    func saveString(_ value: String, account: String) throws
    func readString(account: String) throws -> String?
    func delete(account: String) throws
}

protocol PreferencesStoring {
    func string(forKey defaultName: String) -> String?
    func bool(forKey defaultName: String) -> Bool
    func object(forKey defaultName: String) -> Any?
    func set(_ value: Any?, forKey defaultName: String)
    func removeObject(forKey defaultName: String)
}

@MainActor
protocol GitHubAuthenticating {
    func authenticate(startURL: URL, callbackScheme: String) async throws -> URL
}

protocol URLSessionDataLoading {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension UserDefaults: PreferencesStoring {}
extension URLSession: URLSessionDataLoading {}

enum AccountLoadPhase: Equatable {
    case idle
    case connectingGitHub
    case securingDevice
    case loadingAccount
    case readingRunningTotals
    case updatingScore
    case refreshingScore

    var blocksAccountContent: Bool {
        switch self {
        case .connectingGitHub, .securingDevice, .loadingAccount, .readingRunningTotals, .updatingScore, .refreshingScore:
            return true
        case .idle:
            return false
        }
    }

    var isInitialRunSync: Bool {
        switch self {
        case .readingRunningTotals, .updatingScore, .refreshingScore:
            return true
        case .idle, .connectingGitHub, .securingDevice, .loadingAccount:
            return false
        }
    }

    var message: String {
        switch self {
        case .idle:
            return "Loading your Pace & Push profile..."
        case .connectingGitHub:
            return "Connecting GitHub..."
        case .securingDevice:
            return "Securing device session..."
        case .loadingAccount:
            return "Loading profile and leaderboard..."
        case .readingRunningTotals:
            return "Reading running totals..."
        case .updatingScore:
            return "Updating your score..."
        case .refreshingScore:
            return "Refreshing Pace & Push profile..."
        }
    }

    var detail: String {
        switch self {
        case .idle:
            return "Your account is connected. Pace & Push is fetching the first profile snapshot."
        case .connectingGitHub:
            return "Finishing secure sign-in and preparing your device connection."
        case .securingDevice:
            return "Creating a secure device session for your GitHub account."
        case .loadingAccount:
            return "Fetching your GitHub identity, score, leaderboard, and profile history."
        case .readingRunningTotals:
            return "Reading daily running totals from Apple Health."
        case .updatingScore:
            return "Uploading daily totals and recalculating your Pace & Push score."
        case .refreshingScore:
            return "Pulling the updated profile, score, and leaderboard position."
        }
    }

    var progressValue: Double {
        switch self {
        case .idle:
            return 0.12
        case .connectingGitHub:
            return 0.18
        case .securingDevice:
            return 0.32
        case .loadingAccount:
            return 0.52
        case .readingRunningTotals:
            return 0.68
        case .updatingScore:
            return 0.82
        case .refreshingScore:
            return 0.92
        }
    }

    var progressAccessibilityValue: String {
        switch self {
        case .idle:
            return "Preparing account"
        case .connectingGitHub:
            return "Connecting GitHub"
        case .securingDevice:
            return "Securing device session"
        case .loadingAccount:
            return "Loading profile and leaderboard"
        case .readingRunningTotals:
            return "Reading running totals"
        case .updatingScore:
            return "Updating score"
        case .refreshingScore:
            return "Refreshing profile"
        }
    }

    var setupSteps: [AccountSetupStepStatus] {
        let states: [AccountSetupStep: AccountSetupStepState]
        switch self {
        case .idle:
            states = [
                .githubConnection: .complete,
                .accountSnapshot: .active,
                .runningTotals: .pending,
                .scoreUpdate: .pending,
            ]
        case .connectingGitHub, .securingDevice:
            states = [
                .githubConnection: .active,
                .accountSnapshot: .pending,
                .runningTotals: .pending,
                .scoreUpdate: .pending,
            ]
        case .loadingAccount:
            states = [
                .githubConnection: .complete,
                .accountSnapshot: .active,
                .runningTotals: .pending,
                .scoreUpdate: .pending,
            ]
        case .readingRunningTotals:
            states = [
                .githubConnection: .complete,
                .accountSnapshot: .complete,
                .runningTotals: .active,
                .scoreUpdate: .pending,
            ]
        case .updatingScore, .refreshingScore:
            states = [
                .githubConnection: .complete,
                .accountSnapshot: .complete,
                .runningTotals: .complete,
                .scoreUpdate: .active,
            ]
        }

        return AccountSetupStep.allCases.map { step in
            AccountSetupStepStatus(step: step, state: states[step] ?? .pending)
        }
    }
}

enum AccountSetupStep: CaseIterable, Identifiable {
    case githubConnection
    case accountSnapshot
    case runningTotals
    case scoreUpdate

    var id: Self { self }

    var label: String {
        switch self {
        case .githubConnection:
            return "GitHub connection"
        case .accountSnapshot:
            return "Profile and leaderboard"
        case .runningTotals:
            return "Running totals"
        case .scoreUpdate:
            return "Score update"
        }
    }
}

enum AccountSetupStepState: Equatable {
    case pending
    case active
    case complete

    var accessibilityLabel: String {
        switch self {
        case .pending:
            return "pending"
        case .active:
            return "in progress"
        case .complete:
            return "complete"
        }
    }
}

struct AccountSetupStepStatus: Identifiable {
    let step: AccountSetupStep
    let state: AccountSetupStepState

    var id: AccountSetupStep { step }
    var label: String { step.label }
}

@MainActor
final class PacePushStore: ObservableObject {
    private let callbackScheme = "pacepush"
    private let tokenKey = "mobileDeviceToken"
    private let healthKey = "healthAuthorized"
    private let demoModeKey = "demoModeEnabled"
    private let firstSyncKey = "firstSyncAt"
    private let themePreferenceKey = "themePreference"
    private let unitsKey = "distanceUnits"
    private let activePeriodKey = "activeScorePeriod"
    private let publicLeaderboardPreferenceKey = "publicLeaderboardPreference"
    private let publicLeaderboardPreferenceChosenKey = "publicLeaderboardPreferenceChosen"
    private let historicalDistanceSyncVersionKey = "historicalDistanceSyncVersion"
    private let keychain: KeychainStoring
    private let healthSync: HealthDistanceSyncing
    private let authSession: GitHubAuthenticating
    private let preferences: PreferencesStoring
    private let apiClientFactory: (URL, String?) -> PacePushClienting
    private let deviceLabel: @MainActor () -> String
    private let now: () -> Date
    private let bootstrapSyncEnabled: Bool
    private var pendingMobileAuthCodeVerifier: String?
    private static let distanceUploadBatchSize = 45
    private static let historicalDistanceSyncVersion = "current-utc-year-v1"

    @Published var leaderboard = LeaderboardResponse.seed
    @Published var me = MeResponse.seed
    @Published var profile = PublicProfileResponse.seed
    @Published var apiBaseURL = "https://paceandpush.com"
    @Published var deviceToken: String?
    @Published var healthAuthorized: Bool
    @Published var isDemoMode: Bool
    @Published var firstSyncAt: String?
    @Published var publicLeaderboardPreference: Bool
    @Published var publicLeaderboardPreferenceChosen: Bool
    @Published var activePeriod: ScorePeriod {
        didSet {
            preferences.set(activePeriod.rawValue, forKey: activePeriodKey)
        }
    }
    @Published var lastError: String?
    @Published var lastSuccess: String?
    @Published var busy = false
    @Published var accountLoadPhase: AccountLoadPhase = .idle
    @Published var hasLoadedAccountSnapshot = false
    @Published var themePreference: BrandThemePreference {
        didSet {
            preferences.set(themePreference.rawValue, forKey: themePreferenceKey)
        }
    }
    @Published var units: DistanceUnits {
        didSet {
            preferences.set(units.rawValue, forKey: unitsKey)
        }
    }

    var isGitHubConnected: Bool {
        deviceToken != nil
    }

    var showsServerSettings: Bool {
        allowsAPIBaseURLOverride
    }

    var shareProfileURL: URL? {
        guard isGitHubConnected, hasLoadedAccountSnapshot, firstSyncAt != nil else { return nil }
        return SupportLinks.publicProfileURL(login: me.login)
    }

    func isCurrentUser(_ row: LeaderboardRow) -> Bool {
        isGitHubConnected && hasLoadedAccountSnapshot && row.login.localizedCaseInsensitiveCompare(me.login) == .orderedSame
    }

    var onboardingComplete: Bool {
        isDemoMode || (publicLeaderboardPreferenceChosen && isGitHubConnected && healthAuthorized)
    }

    var canRetryFirstSync: Bool {
        setupReadyForFirstSync && !busy
    }

    var githubConnectionStatus: String {
        if isDemoMode { return "Demo data" }
        guard isGitHubConnected else { return "Disconnected" }
        return hasLoadedAccountSnapshot ? "@\(me.login)" : "Loading..."
    }

    var githubOnboardingStatus: String {
        guard isGitHubConnected else { return "Used for commit counts and account identity." }
        return hasLoadedAccountSnapshot ? "@\(me.login) connected" : "Loading GitHub account..."
    }

    var lastSyncStatus: String {
        if isDemoMode { return "Demo data" }
        if firstSyncAt == nil, shouldShowAccountLoading {
            return "In progress"
        }
        return firstSyncAt ?? "Never"
    }

    var syncActionTitle: String {
        if accountLoadPhase.isInitialRunSync {
            return "Syncing..."
        }
        return busy ? "Working..." : "Sync Now"
    }

    var shouldShowAccountLoading: Bool {
        guard isGitHubConnected else { return false }
        if accountLoadPhase.blocksAccountContent { return true }
        return !hasLoadedAccountSnapshot && lastError == nil
    }

    var accountContentError: String? {
        guard isGitHubConnected, !hasLoadedAccountSnapshot else { return nil }
        return lastError
    }

    var accountLoadingTitle: String {
        accountLoadPhase.isInitialRunSync ? "Setting up Pace & Push" : "Loading account"
    }

    var accountLoadingMessage: String {
        accountLoadPhase.message
    }

    var accountLoadingDetail: String {
        accountLoadPhase.detail
    }

    init(
        keychain: KeychainStoring = KeychainStore(service: "com.paceandpush.app"),
        healthSync: HealthDistanceSyncing = HealthKitDistanceSync(),
        authSession: GitHubAuthenticating? = nil,
        preferences: PreferencesStoring = UserDefaults.standard,
        apiClientFactory: @escaping (URL, String?) -> PacePushClienting = { baseURL, token in
            PacePushAPIClient(baseURL: baseURL, token: token)
        },
        deviceLabel: (@MainActor () -> String)? = nil,
        now: @escaping () -> Date = Date.init,
        bootstrapSyncEnabled: Bool = true,
    ) {
        self.keychain = keychain
        self.healthSync = healthSync
        self.authSession = authSession ?? GitHubAuthSession()
        self.preferences = preferences
        self.apiClientFactory = apiClientFactory
        self.deviceLabel = deviceLabel ?? { UIDevice.current.name }
        self.now = now
        self.bootstrapSyncEnabled = bootstrapSyncEnabled

        let savedUnits = preferences.string(forKey: unitsKey)
        units = DistanceUnits(rawValue: savedUnits ?? "") ?? .metric
        themePreference = preferences.string(forKey: themePreferenceKey)
            .flatMap { BrandThemePreference(rawValue: $0) }
            ?? .system
        healthAuthorized = preferences.bool(forKey: healthKey)
        firstSyncAt = preferences.string(forKey: firstSyncKey)
        publicLeaderboardPreference = preferences.object(forKey: publicLeaderboardPreferenceKey) as? Bool ?? true
        publicLeaderboardPreferenceChosen = preferences.bool(forKey: publicLeaderboardPreferenceChosenKey)
        isDemoMode = preferences.bool(forKey: demoModeKey)
        activePeriod = preferences.string(forKey: activePeriodKey)
            .flatMap { ScorePeriod($0) }
            ?? ScorePeriod(kind: .month, date: now())
        deviceToken = try? keychain.readString(account: tokenKey)

        if isDemoMode {
            applyDemoSnapshot()
        }
    }

    func bootstrap() async {
        if isDemoMode {
            applyDemoSnapshot()
            return
        }
        guard deviceToken != nil else { return }
        await refresh()
        await syncHistoricalDistanceIfNeeded()
        await syncFirstRunIfReady()
    }

    func connectGitHub() async {
        if isDemoMode {
            leaveDemoModeForRealFlow()
        }

        guard let baseURL = URL(string: apiBaseURL) else {
            lastError = "API base URL is invalid."
            lastSuccess = nil
            return
        }

        busy = true
        accountLoadPhase = .connectingGitHub
        lastError = nil
        lastSuccess = nil
        defer {
            busy = false
            if accountLoadPhase == .connectingGitHub {
                accountLoadPhase = .idle
            }
        }

        do {
            let client = apiClientFactory(baseURL, nil)
            let pkce = try MobileAuthPKCE.generate()
            pendingMobileAuthCodeVerifier = pkce.verifier
            let callback = try await authSession.authenticate(
                startURL: client.mobileGitHubStartURL(
                    platform: "ios",
                    label: deviceLabel(),
                    callbackScheme: callbackScheme,
                    codeChallenge: pkce.challenge,
                ),
                callbackScheme: callbackScheme,
            )
            try await finishGitHubCallback(callback, codeVerifier: pkce.verifier)
        } catch {
            pendingMobileAuthCodeVerifier = nil
            accountLoadPhase = .idle
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
        busy = true
        accountLoadPhase = .loadingAccount
        defer {
            busy = false
            if accountLoadPhase != .idle {
                accountLoadPhase = .idle
            }
        }

        do {
            try await finishGitHubCallback(url)
        } catch {
            accountLoadPhase = .idle
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

        guard let baseURL = (allowsAPIBaseURLOverride ? pairing.baseURL : nil) ?? currentBaseURL else {
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
        guard !isDemoMode else {
            lastError = nil
            lastSuccess = "Demo mode uses sample running data."
            return
        }

        busy = true
        lastError = nil
        lastSuccess = nil
        defer { busy = false }

        do {
            try await healthSync.requestAuthorization()
            healthAuthorized = true
            preferences.set(true, forKey: healthKey)
            if isGitHubConnected {
                await syncFirstRunIfReady()
            } else {
                lastSuccess = "Apple Health enabled. Next, connect GitHub."
            }
        } catch {
            lastError = "Apple Health is unavailable or permission was not granted. Open Settings > Health > Data Access & Devices > Pace & Push to allow running workouts, then retry."
            lastSuccess = nil
        }
    }

    func setPublicLeaderboardPreference(_ isPublic: Bool) async {
        publicLeaderboardPreference = isPublic
        publicLeaderboardPreferenceChosen = true
        preferences.set(isPublic, forKey: publicLeaderboardPreferenceKey)
        preferences.set(true, forKey: publicLeaderboardPreferenceChosenKey)

        guard !isDemoMode else {
            applyDemoSnapshot()
            return
        }

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
            preferences.set(publicLeaderboardPreference, forKey: publicLeaderboardPreferenceKey)
            lastError = error.localizedDescription
            lastSuccess = nil
        }
    }

    func confirmPublicLeaderboardPreference() async {
        await setPublicLeaderboardPreference(publicLeaderboardPreference)
    }

    func disconnectGitHub() async {
        guard !isDemoMode else {
            exitDemoMode()
            return
        }

        guard let token = deviceToken else {
            signOut()
            lastSuccess = "Signed out. GitHub contribution access is off."
            return
        }

        guard let baseURL = URL(string: apiBaseURL) else {
            signOut()
            lastError = nil
            lastSuccess = nil
            return
        }

        busy = true
        lastError = nil
        lastSuccess = nil
        signOut()
        busy = false

        do {
            let client = apiClientFactory(baseURL, token)
            _ = try await client.disconnectGitHub()
            lastSuccess = "Signed out. GitHub contribution access is off."
        } catch {
            lastError = nil
            lastSuccess = nil
        }
    }

    func exportAccountData() async -> AccountExportItem? {
        guard !isDemoMode else {
            lastError = "Demo mode uses sample data only."
            lastSuccess = nil
            return nil
        }

        guard let token = deviceToken, let baseURL = URL(string: apiBaseURL) else {
            lastError = "Connect GitHub before exporting data."
            lastSuccess = nil
            return nil
        }

        busy = true
        lastError = nil
        lastSuccess = nil
        defer { busy = false }

        do {
            let client = apiClientFactory(baseURL, token)
            let export = try await client.exportAccountData()
            lastSuccess = "Data export ready."
            return AccountExportItem(text: export)
        } catch PacePushAPIError.unauthorized {
            signOut()
            lastError = "This device was revoked. Connect GitHub again."
        } catch {
            lastError = error.localizedDescription
            lastSuccess = nil
        }
        return nil
    }

    func deleteAccount() async {
        guard !isDemoMode else {
            exitDemoMode()
            lastSuccess = "Demo mode cleared."
            return
        }

        guard let token = deviceToken, let baseURL = URL(string: apiBaseURL) else {
            signOut()
            lastSuccess = "Account deleted."
            return
        }

        busy = true
        lastError = nil
        lastSuccess = nil
        defer { busy = false }

        do {
            let client = apiClientFactory(baseURL, token)
            _ = try await client.deleteAccount()
            signOut()
            lastSuccess = "Account deleted."
        } catch PacePushAPIError.unauthorized {
            signOut()
            lastError = "This device was revoked. Connect GitHub again."
        } catch {
            lastError = error.localizedDescription
            lastSuccess = nil
        }
    }

    func syncRunningDistance(successMessage: String = "Running data synced.") async {
        guard !isDemoMode else {
            lastError = nil
            lastSuccess = "Demo mode uses sample running data."
            return
        }

        guard let token = deviceToken, let baseURL = URL(string: apiBaseURL) else {
            lastError = "Connect GitHub before syncing."
            lastSuccess = nil
            return
        }

        let isInitialSync = firstSyncAt == nil
        busy = true
        if isInitialSync {
            accountLoadPhase = .readingRunningTotals
        }
        defer {
            busy = false
            if isInitialSync {
                accountLoadPhase = .idle
            }
        }
        lastError = nil
        lastSuccess = nil
        let startedAt = now()

        do {
            let client = apiClientFactory(baseURL, token)
            let syncEnd = now()
            let syncStart = Self.historicalDistanceSyncStartDate(through: syncEnd)
            let result = try await healthSync.collectDistanceDays(
                from: syncStart,
                through: syncEnd,
            )
            let foundRunningDistance = result.days.contains { $0.meters > 0 }
            var acceptedDays = 0
            var flaggedDays = 0
            if isInitialSync {
                accountLoadPhase = .updatingScore
            }
            for batchStart in stride(from: 0, to: result.days.count, by: Self.distanceUploadBatchSize) {
                let batchEnd = min(batchStart + Self.distanceUploadBatchSize, result.days.count)
                let batch = Array(result.days[batchStart..<batchEnd])
                let upload = try await client.uploadDistanceDays(batch)
                acceptedDays += upload.accepted
                flaggedDays += upload.flagged
            }
            try await client.recordSyncRun(
                SyncRunRequest(
                    platform: "ios",
                    status: (!foundRunningDistance || flaggedDays > 0) ? "warning" : "success",
                    startedAt: startedAt.isoString,
                    finishedAt: now().isoString,
                    counters: [
                        "days": result.days.count,
                        "accepted": acceptedDays,
                        "flagged": flaggedDays,
                    ],
                    errorSummary: nil,
                ),
            )
            firstSyncAt = now().isoString
            preferences.set(firstSyncAt, forKey: firstSyncKey)
            preferences.set(Self.historicalDistanceSyncVersion, forKey: historicalDistanceSyncVersionKey)
            if isInitialSync {
                accountLoadPhase = .refreshingScore
            }
            await refresh()
            if lastError == nil {
                lastSuccess = foundRunningDistance
                    ? successMessage
                    : "No running distance found. If you expected a run, check Apple Health sharing for Pace & Push, then sync again."
            }
        } catch PacePushAPIError.unauthorized {
            signOut()
            lastError = "This device was revoked. Connect GitHub again."
        } catch {
            if let client = URL(string: apiBaseURL).map({ apiClientFactory($0, token) }) {
                try? await client.recordSyncRun(
                    SyncRunRequest(
                        platform: "ios",
                        status: "error",
                        startedAt: startedAt.isoString,
                        finishedAt: now().isoString,
                        counters: [:],
                        errorSummary: error.localizedDescription,
                    ),
                )
            }
            lastError = error.localizedDescription
            lastSuccess = nil
        }
    }

    func refresh(board: Board = .balanced) async {
        guard !isDemoMode else {
            applyDemoSnapshot(board: board)
            return
        }

        guard let baseURL = URL(string: apiBaseURL) else { return }
        let shouldMarkAccountLoading = deviceToken != nil && !hasLoadedAccountSnapshot && accountLoadPhase == .idle
        if shouldMarkAccountLoading {
            accountLoadPhase = .loadingAccount
        }
        defer {
            if shouldMarkAccountLoading {
                accountLoadPhase = .idle
            }
        }

        do {
            let client = apiClientFactory(baseURL, deviceToken)
            async let leaderboardResponse = client.fetchLeaderboard(board: board, period: activePeriod.rawValue)
            if deviceToken != nil {
                async let meResponse = client.fetchMe(period: activePeriod.rawValue)
                async let profileResponse = client.fetchProfile(period: activePeriod.rawValue)
                leaderboard = try await leaderboardResponse
                me = try await meResponse
                publicLeaderboardPreference = me.publicLeaderboard
                publicLeaderboardPreferenceChosen = true
                preferences.set(publicLeaderboardPreference, forKey: publicLeaderboardPreferenceKey)
                preferences.set(true, forKey: publicLeaderboardPreferenceChosenKey)
                profile = try await profileResponse
                hasLoadedAccountSnapshot = true
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

    func refreshLeaderboard(board: Board = .balanced) async {
        guard !isDemoMode else {
            leaderboard = DemoData.leaderboard(period: activePeriod, board: board)
            lastError = nil
            return
        }

        guard let baseURL = URL(string: apiBaseURL) else { return }

        do {
            let client = apiClientFactory(baseURL, deviceToken)
            leaderboard = try await client.fetchLeaderboard(board: board, period: activePeriod.rawValue)
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

    func fetchPublicProfile(login: String, period: ScorePeriod) async throws -> PublicProfileResponse {
        if isDemoMode {
            return DemoData.profile(login: login, period: period)
        }

        guard let baseURL = URL(string: apiBaseURL) else { throw PacePushAPIError.invalidURL }

        let client = apiClientFactory(baseURL, deviceToken)
        return try await client.fetchPublicProfile(login: login, period: period.rawValue)
    }

    func startDemoMode() {
        isDemoMode = true
        preferences.set(true, forKey: demoModeKey)
        accountLoadPhase = .idle
        hasLoadedAccountSnapshot = true
        lastError = nil
        lastSuccess = nil
        busy = false
        applyDemoSnapshot()
    }

    func exitDemoMode() {
        leaveDemoModeForRealFlow()
        lastError = nil
        lastSuccess = nil
    }

    func setActivePeriod(_ period: ScorePeriod, board: Board = .balanced) async {
        guard period != activePeriod else { return }
        activePeriod = period
        await refresh(board: board)
    }

    func signOut() {
        try? keychain.delete(account: tokenKey)
        deviceToken = nil
        isDemoMode = false
        preferences.removeObject(forKey: demoModeKey)
        hasLoadedAccountSnapshot = false
        accountLoadPhase = .idle
        firstSyncAt = nil
        preferences.removeObject(forKey: firstSyncKey)
        preferences.removeObject(forKey: historicalDistanceSyncVersionKey)
        me = .seed
        profile = .seed
        lastSuccess = nil
    }

    private func applyDemoSnapshot(board: Board = .balanced) {
        leaderboard = DemoData.leaderboard(period: activePeriod, board: board)
        me = DemoData.me(period: activePeriod)
        profile = DemoData.profile(login: DemoData.primaryLogin, period: activePeriod)
        hasLoadedAccountSnapshot = true
        lastError = nil
    }

    private func leaveDemoModeForRealFlow() {
        isDemoMode = false
        preferences.removeObject(forKey: demoModeKey)
        hasLoadedAccountSnapshot = false
        accountLoadPhase = .idle
        leaderboard = .seed
        me = .seed
        profile = .seed
    }

    private func savePublicLeaderboardPreference(_ isPublic: Bool, baseURL: URL, token: String) async throws {
        let client = apiClientFactory(baseURL, token)
        let settings = try await client.updateSettings(publicLeaderboard: isPublic, units: nil)
        publicLeaderboardPreference = settings.publicLeaderboard
        publicLeaderboardPreferenceChosen = true
        preferences.set(settings.publicLeaderboard, forKey: publicLeaderboardPreferenceKey)
        preferences.set(true, forKey: publicLeaderboardPreferenceChosenKey)
    }

    func formatDistance(_ kilometers: Double, includeUnit: Bool = false) -> String {
        units.format(kilometers, includeUnit: includeUnit)
    }

    private func finishGitHubCallback(_ url: URL, codeVerifier: String? = nil) async throws {
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

        guard let codeVerifier = codeVerifier ?? pendingMobileAuthCodeVerifier else {
            throw PacePushAPIError.server("GitHub sign-in expired. Please start GitHub connection again.")
        }

        accountLoadPhase = .securingDevice
        let preferredPublicLeaderboard = publicLeaderboardPreference
        let shouldSyncPublicLeaderboardPreference = publicLeaderboardPreferenceChosen
        let client = apiClientFactory(baseURL, nil)
        let exchange = try await client.exchangeMobileAuthCode(code, codeVerifier: codeVerifier)
        pendingMobileAuthCodeVerifier = nil
        try keychain.saveString(exchange.token, account: tokenKey)
        hasLoadedAccountSnapshot = false
        deviceToken = exchange.token
        accountLoadPhase = .loadingAccount
        if shouldSyncPublicLeaderboardPreference {
            try? await savePublicLeaderboardPreference(
                preferredPublicLeaderboard,
                baseURL: baseURL,
                token: exchange.token,
            )
        }
        await refresh()
        if lastError == nil {
            if healthAuthorized {
                await syncFirstRunIfReady()
            } else {
                lastSuccess = "GitHub connected. Next, enable Apple Health."
            }
        }
        accountLoadPhase = .idle
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
        let client = apiClientFactory(baseURL, nil)
        accountLoadPhase = .securingDevice
        let exchange = try await client.exchangeDevicePairing(
            code: pairing.code,
            platform: "ios",
            label: deviceLabel(),
        )
        try keychain.saveString(exchange.token, account: tokenKey)
        hasLoadedAccountSnapshot = false
        deviceToken = exchange.token
        accountLoadPhase = .loadingAccount

        if allowsAPIBaseURLOverride, pairing.baseURL != nil {
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
        await syncFirstRunIfReady()
        accountLoadPhase = .idle
    }

    private var setupReadyForFirstSync: Bool {
        isGitHubConnected && healthAuthorized && firstSyncAt == nil
    }

    private var allowsAPIBaseURLOverride: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
    }

    private var needsHistoricalDistanceSync: Bool {
        isGitHubConnected &&
            healthAuthorized &&
            preferences.string(forKey: historicalDistanceSyncVersionKey) != Self.historicalDistanceSyncVersion
    }

    private static func historicalDistanceSyncStartDate(through endDate: Date) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let year = calendar.component(.year, from: endDate)
        return calendar.date(from: DateComponents(timeZone: calendar.timeZone, year: year, month: 1, day: 1)) ?? endDate
    }

    private func syncHistoricalDistanceIfNeeded() async {
        guard bootstrapSyncEnabled, needsHistoricalDistanceSync else { return }
        await syncRunningDistance(successMessage: "Running history synced.")
    }

    private func syncFirstRunIfReady() async {
        guard bootstrapSyncEnabled, setupReadyForFirstSync else { return }
        await syncRunningDistance(successMessage: "Setup complete. Running data synced.")
    }
}

extension PacePushStore {
    static func launchStore(arguments: [String] = ProcessInfo.processInfo.arguments) -> PacePushStore {
        #if DEBUG
        let isUITesting = arguments.contains("-uiTesting") ||
            arguments.contains("-uiTestingSeeded") ||
            arguments.contains("-uiTestingReadyNoSync") ||
            arguments.contains("-uiTestingPrivateLeaderboard")
        guard isUITesting else { return PacePushStore() }

        let isSeeded = arguments.contains("-uiTestingSeeded")
        let isReadyWithoutSync = arguments.contains("-uiTestingReadyNoSync")
        let isPrivateLeaderboard = arguments.contains("-uiTestingPrivateLeaderboard")
        let hasConnectedSeed = isSeeded || isReadyWithoutSync || isPrivateLeaderboard
        var preferences: [String: Any] = hasConnectedSeed ? [
            "healthAuthorized": true,
            "publicLeaderboardPreference": !isPrivateLeaderboard,
            "publicLeaderboardPreferenceChosen": true,
            "distanceUnits": "metric",
        ] : [:]
        if isSeeded {
            preferences["firstSyncAt"] = "2026-07-06T12:00:00.000Z"
        }

        return PacePushStore(
            keychain: UITestingKeychain(values: hasConnectedSeed ? ["mobileDeviceToken": "ui-testing-token"] : [:]),
            healthSync: UITestingHealthSync(),
            authSession: UITestingGitHubAuthSession(),
            preferences: UITestingPreferences(values: preferences),
            apiClientFactory: { _, _ in UITestingPacePushClient(publicLeaderboard: !isPrivateLeaderboard) },
            deviceLabel: { "UI Test iPhone" },
            now: { ISO8601DateFormatter.pacePush.date(from: "2026-07-06T12:00:00.000Z") ?? Date() },
            bootstrapSyncEnabled: false
        )
        #else
        return PacePushStore()
        #endif
    }
}

#if DEBUG
private final class UITestingKeychain: KeychainStoring {
    private var values: [String: String]

    init(values: [String: String]) {
        self.values = values
    }

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

private final class UITestingPreferences: PreferencesStoring {
    private var values: [String: Any]

    init(values: [String: Any]) {
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

private struct UITestingHealthSync: HealthDistanceSyncing {
    var isAvailable: Bool { true }

    func requestAuthorization() async throws {}

    func collectDistanceDays(from startDate: Date, through endDate: Date) async throws -> HealthKitDistanceSyncResult {
        HealthKitDistanceSyncResult(days: [], startedAt: startDate, finishedAt: endDate)
    }
}

private struct UITestingGitHubAuthSession: GitHubAuthenticating {
    func authenticate(startURL: URL, callbackScheme: String) async throws -> URL {
        URL(string: "\(callbackScheme)://auth/callback?code=ui-testing-code")!
    }
}

private final class UITestingPacePushClient: PacePushClienting {
    private let publicLeaderboard: Bool

    init(publicLeaderboard: Bool = true) {
        self.publicLeaderboard = publicLeaderboard
    }

    func mobileGitHubStartURL(platform: String, label: String, callbackScheme: String, codeChallenge: String) throws -> URL {
        URL(string: "https://paceandpush.com/api/mobile/auth/github/start?platform=\(platform)&callbackScheme=\(callbackScheme)&codeChallenge=\(codeChallenge)")!
    }

    func exchangeMobileAuthCode(_ code: String, codeVerifier: String) async throws -> DeviceExchangeResponse {
        deviceExchangeResponse
    }

    func exchangeDevicePairing(code: String, platform: String, label: String) async throws -> DeviceExchangeResponse {
        deviceExchangeResponse
    }

    func disconnectGitHub() async throws -> GitHubDisconnectResponse {
        GitHubDisconnectResponse(login: "noc2", disconnectedAt: "2026-07-06T12:00:00.000Z")
    }

    func exportAccountData() async throws -> String {
        return #"{"exportedAt":"2026-07-06T12:00:00.000Z","data":{"account":{"login":"noc2"}}}"#
    }

    func deleteAccount() async throws -> AccountDeletionResponse {
        AccountDeletionResponse(login: "noc2", status: "deleted", deletedAt: "2026-07-06T12:00:00.000Z")
    }

    func fetchLeaderboard(board: Board, period: String) async throws -> LeaderboardResponse {
        LeaderboardResponse(
            period: period,
            board: board,
            rows: [
                LeaderboardRow(rank: 1, login: "noc2", displayName: "David", score: 94.2, commits: 312, kilometers: 86.4, streakDays: 11),
            ]
        )
    }

    func fetchMe(period: String) async throws -> MeResponse {
        MeResponse(
            login: "noc2",
            displayName: "David",
            publicLeaderboard: publicLeaderboard,
            units: "metric",
            score: ScoreSummary(period: period, score: 94.2, rank: 1, commits: 312, kilometers: 86.4, lastSyncAt: "2026-07-06T12:00:00.000Z"),
            devices: [deviceExchangeResponse.device]
        )
    }

    func fetchProfile(period: String) async throws -> PublicProfileResponse {
        PublicProfileResponse(
            login: "noc2",
            displayName: "David",
            bio: nil,
            score: ScoreSummary(period: period, score: 94.2, rank: 1, commits: 312, kilometers: 86.4, lastSyncAt: "2026-07-06T12:00:00.000Z"),
            history: [
                ProfileHistoryPoint(date: "2026-07-01", commits: 41, kilometers: 8.1, score: 42.8),
                ProfileHistoryPoint(date: "2026-07-02", commits: 93, kilometers: 23.5, score: 68.4),
                ProfileHistoryPoint(date: "2026-07-03", commits: 128, kilometers: 31.2, score: 75.6),
                ProfileHistoryPoint(date: "2026-07-04", commits: 176, kilometers: 43.8, score: 80.9),
                ProfileHistoryPoint(date: "2026-07-05", commits: 219, kilometers: 58.7, score: 86.3),
                ProfileHistoryPoint(date: "2026-07-06", commits: 312, kilometers: 86.4, score: 94.2),
            ]
        )
    }

    func fetchPublicProfile(login: String, period: String) async throws -> PublicProfileResponse {
        PublicProfileResponse(
            login: login,
            displayName: login.localizedCaseInsensitiveCompare("noc2") == .orderedSame ? "David" : login,
            bio: nil,
            score: ScoreSummary(period: period, score: 94.2, rank: 1, commits: 312, kilometers: 86.4, lastSyncAt: "2026-07-06T12:00:00.000Z"),
            history: [
                ProfileHistoryPoint(date: "2026-07-01", commits: 41, kilometers: 8.1, score: 42.8),
                ProfileHistoryPoint(date: "2026-07-02", commits: 93, kilometers: 23.5, score: 68.4),
                ProfileHistoryPoint(date: "2026-07-03", commits: 128, kilometers: 31.2, score: 75.6),
                ProfileHistoryPoint(date: "2026-07-04", commits: 176, kilometers: 43.8, score: 80.9),
                ProfileHistoryPoint(date: "2026-07-05", commits: 219, kilometers: 58.7, score: 86.3),
                ProfileHistoryPoint(date: "2026-07-06", commits: 312, kilometers: 86.4, score: 94.2),
            ]
        )
    }

    func updateSettings(publicLeaderboard: Bool?, units: String?) async throws -> AccountSettingsResponse {
        AccountSettingsResponse(
            login: "noc2",
            displayName: "David",
            publicLeaderboard: publicLeaderboard ?? self.publicLeaderboard,
            units: units ?? "metric"
        )
    }

    func uploadDistanceDays(_ days: [HealthKitDistanceDay]) async throws -> DistanceDaysResponse {
        DistanceDaysResponse(accepted: days.count, flagged: 0)
    }

    func recordSyncRun(_ run: SyncRunRequest) async throws {}

    private var deviceExchangeResponse: DeviceExchangeResponse {
        DeviceExchangeResponse(
            device: MobileDeviceSummary(
                id: "ui-testing-device",
                platform: "ios",
                label: "UI Test iPhone",
                lastSeenAt: "2026-07-06T12:00:00.000Z",
                revoked: false
            ),
            token: "ui-testing-token"
        )
    }
}
#endif

final class PacePushAPIClient: PacePushClienting {
    let baseURL: URL
    let token: String?
    private let dataLoader: URLSessionDataLoading

    init(baseURL: URL, token: String?, dataLoader: URLSessionDataLoading = URLSession.shared) {
        self.baseURL = baseURL
        self.token = token
        self.dataLoader = dataLoader
    }

    func mobileGitHubStartURL(platform: String, label: String, callbackScheme: String, codeChallenge: String) throws -> URL {
        var components = URLComponents(url: url("/api/mobile/auth/github/start"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "platform", value: platform),
            URLQueryItem(name: "label", value: label),
            URLQueryItem(name: "callbackScheme", value: callbackScheme),
            URLQueryItem(name: "codeChallenge", value: codeChallenge),
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

    func exchangeMobileAuthCode(_ code: String, codeVerifier: String) async throws -> DeviceExchangeResponse {
        try await post(
            "/api/mobile/auth/exchange",
            body: MobileAuthExchangeRequest(code: code, codeVerifier: codeVerifier),
            authenticated: false,
        )
    }

    func disconnectGitHub() async throws -> GitHubDisconnectResponse {
        try await delete("/api/mobile/me/github/disconnect", authenticated: true)
    }

    func exportAccountData() async throws -> String {
        try await fetchRawJSON("/api/mobile/me/privacy-export", authenticated: true)
    }

    func deleteAccount() async throws -> AccountDeletionResponse {
        try await delete("/api/mobile/me/delete", authenticated: true)
    }

    func fetch<T: Decodable>(
        _ path: String,
        queryItems: [URLQueryItem] = [],
        authenticated: Bool,
        cachePolicy: URLRequest.CachePolicy = .useProtocolCachePolicy,
    ) async throws -> T {
        var request = URLRequest(url: url(path, queryItems: queryItems), cachePolicy: cachePolicy)
        request.setValue("application/json", forHTTPHeaderField: "accept")
        if cachePolicy != .useProtocolCachePolicy {
            request.setValue("no-cache", forHTTPHeaderField: "cache-control")
        }
        if authenticated {
            try authorize(&request)
        }
        let (data, response) = try await dataLoader.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(T.self, from: data)
    }

    func fetchRawJSON(_ path: String, authenticated: Bool) async throws -> String {
        var request = URLRequest(url: url(path))
        request.setValue("application/json", forHTTPHeaderField: "accept")
        if authenticated {
            try authorize(&request)
        }
        let (data, response) = try await dataLoader.data(for: request)
        try validate(response: response, data: data)
        guard let body = String(data: data, encoding: .utf8) else {
            throw PacePushAPIError.server("Could not decode account export.")
        }
        return body
    }

    func delete<Response: Decodable>(_ path: String, authenticated: Bool) async throws -> Response {
        var request = URLRequest(url: url(path))
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "accept")
        if authenticated {
            try authorize(&request)
        }
        let (data, response) = try await dataLoader.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(Response.self, from: data)
    }

    func fetchLeaderboard(board: Board, period: String) async throws -> LeaderboardResponse {
        try await fetch(
            "/api/leaderboard",
            queryItems: [
                URLQueryItem(name: "board", value: board.rawValue),
                URLQueryItem(name: "period", value: period),
                URLQueryItem(name: "_appRefresh", value: String(Int(Date().timeIntervalSince1970 * 1000))),
            ],
            authenticated: false,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData,
        )
    }

    func fetchMe(period: String) async throws -> MeResponse {
        try await fetch(
            "/api/mobile/me",
            queryItems: [
                URLQueryItem(name: "period", value: period),
                URLQueryItem(name: "_appRefresh", value: String(Int(Date().timeIntervalSince1970 * 1000))),
            ],
            authenticated: true,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData,
        )
    }

    func fetchProfile(period: String) async throws -> PublicProfileResponse {
        try await fetch(
            "/api/mobile/me/profile",
            queryItems: [
                URLQueryItem(name: "period", value: period),
                URLQueryItem(name: "_appRefresh", value: String(Int(Date().timeIntervalSince1970 * 1000))),
            ],
            authenticated: true,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData,
        )
    }

    func fetchPublicProfile(login: String, period: String) async throws -> PublicProfileResponse {
        try await fetch(
            "/api/users/\(login)",
            queryItems: [URLQueryItem(name: "period", value: period)],
            authenticated: false,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData,
        )
    }

    func updateSettings(publicLeaderboard: Bool?, units: String?) async throws -> AccountSettingsResponse {
        try await patch(
            "/api/mobile/me/settings",
            body: AccountSettingsRequest(publicLeaderboard: publicLeaderboard, units: units),
            authenticated: true,
        )
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
        let (data, response) = try await dataLoader.data(for: request)
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
        let (data, response) = try await dataLoader.data(for: request)
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

    func url(_ path: String, queryItems: [URLQueryItem] = []) -> URL {
        let url = baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        guard !queryItems.isEmpty,
              var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else {
            return url
        }
        components.queryItems = queryItems
        return components.url ?? url
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

final class GitHubAuthSession: NSObject, GitHubAuthenticating, ASWebAuthenticationPresentationContextProviding {
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

struct KeychainStore: KeychainStoring {
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

enum ScorePeriodKind: String, CaseIterable, Identifiable {
    case week
    case month
    case year

    var id: String { rawValue }

    var title: String {
        switch self {
        case .week:
            return "Days"
        case .month:
            return "Months"
        case .year:
            return "Years"
        }
    }

    var singularTitle: String {
        switch self {
        case .week:
            return "Days"
        case .month:
            return "Month"
        case .year:
            return "Year"
        }
    }
}

struct ScorePeriodOption: Identifiable {
    let period: ScorePeriod
    let label: String
    let meta: String?
    let disabled: Bool

    var id: String { period.rawValue }

    var menuLabel: String {
        guard let meta else { return label }
        return "\(label) · \(meta)"
    }

    static func options(for activePeriod: ScorePeriod, now: Date = Date()) -> [ScorePeriodOption] {
        switch activePeriod.kind {
        case .week:
            return weekOptions(for: activePeriod, now: now)
        case .month:
            return monthOptions(for: activePeriod, now: now)
        case .year:
            return yearOptions(for: activePeriod, now: now)
        }
    }

    private static func yearOptions(for activePeriod: ScorePeriod, now: Date) -> [ScorePeriodOption] {
        var periods = Set<ScorePeriod>()
        let currentYear = ScorePeriod.gregorian.component(.year, from: now)

        for offset in 0..<5 {
            periods.insert(ScorePeriod(kind: .year, date: ScorePeriod.date(year: currentYear - offset, month: 1, day: 1)))
        }
        periods.insert(ScorePeriod(kind: .year, date: activePeriod.startDate))

        return periods.sorted { $0.rawValue > $1.rawValue }.map { period in
            ScorePeriodOption(
                period: period,
                label: period.label,
                meta: nil,
                disabled: period != activePeriod && period.isFuture(comparedTo: now)
            )
        }
    }

    private static func monthOptions(for activePeriod: ScorePeriod, now: Date) -> [ScorePeriodOption] {
        var periods = Set<ScorePeriod>()
        let referenceYear = ScorePeriod.gregorian.component(.year, from: activePeriod.referenceDate(now: now))

        for month in 1...12 {
            periods.insert(ScorePeriod(kind: .month, date: ScorePeriod.date(year: referenceYear, month: month, day: 1)))
        }
        if activePeriod.kind == .month {
            periods.insert(activePeriod)
        }

        return periods.sorted { $0.rawValue < $1.rawValue }.map { period in
            ScorePeriodOption(
                period: period,
                label: period.shortLabel,
                meta: nil,
                disabled: period != activePeriod && period.isFuture(comparedTo: now)
            )
        }
    }

    private static func weekOptions(for activePeriod: ScorePeriod, now: Date) -> [ScorePeriodOption] {
        var periods = Set<ScorePeriod>()
        let referenceDate = activePeriod.referenceDate(now: now)

        for offset in -2..<10 {
            let date = ScorePeriod.gregorian.date(byAdding: .day, value: -offset * 7, to: referenceDate) ?? referenceDate
            periods.insert(ScorePeriod(kind: .week, date: date))
        }
        if activePeriod.kind == .week {
            periods.insert(activePeriod)
        }

        return periods.sorted { $0.rawValue > $1.rawValue }.map { period in
            ScorePeriodOption(
                period: period,
                label: period.weekRangeLabel,
                meta: period.rawValue,
                disabled: period != activePeriod && period.isFuture(comparedTo: now)
            )
        }
    }
}

struct ScorePeriod: Hashable, Identifiable {
    let rawValue: String

    var id: String { rawValue }

    init?(_ rawValue: String) {
        if Self.isYear(rawValue) || Self.isMonth(rawValue) {
            self.rawValue = rawValue
            return
        }

        guard Self.isValidWeek(rawValue) else { return nil }
        self.rawValue = rawValue
    }

    init(kind: ScorePeriodKind, date: Date) {
        switch kind {
        case .year:
            rawValue = String(Self.gregorian.component(.year, from: date))
        case .month:
            let components = Self.gregorian.dateComponents([.year, .month], from: date)
            rawValue = String(format: "%04d-%02d", components.year ?? 1970, components.month ?? 1)
        case .week:
            rawValue = Self.weekPeriodString(for: date)
        }
    }

    var kind: ScorePeriodKind {
        if Self.isYear(rawValue) { return .year }
        if Self.isValidWeek(rawValue) { return .week }
        return .month
    }

    var startDate: Date {
        switch kind {
        case .year:
            return Self.date(year: Int(rawValue) ?? 1970, month: 1, day: 1)
        case .month:
            let parts = rawValue.split(separator: "-").compactMap { Int($0) }
            return Self.date(year: parts.first ?? 1970, month: parts.dropFirst().first ?? 1, day: 1)
        case .week:
            return Self.weekStart(for: rawValue) ?? Self.date(year: 1970, month: 1, day: 5)
        }
    }

    var endDate: Date {
        switch kind {
        case .year:
            return Self.date(year: Self.gregorian.component(.year, from: startDate), month: 12, day: 31)
        case .month:
            let nextMonth = Self.gregorian.date(byAdding: .month, value: 1, to: startDate) ?? startDate
            return Self.gregorian.date(byAdding: .day, value: -1, to: nextMonth) ?? startDate
        case .week:
            return Self.gregorian.date(byAdding: .day, value: 6, to: startDate) ?? startDate
        }
    }

    var label: String {
        switch kind {
        case .year:
            return rawValue
        case .month:
            return Self.monthFormatter.string(from: startDate)
        case .week:
            return "\(weekRangeLabel), \(rawValue.prefix(4))"
        }
    }

    var shortLabel: String {
        switch kind {
        case .year:
            return rawValue
        case .month:
            return Self.shortMonthFormatter.string(from: startDate)
        case .week:
            return weekRangeLabel
        }
    }

    var weekRangeLabel: String {
        if Self.gregorian.component(.year, from: startDate) == Self.gregorian.component(.year, from: endDate) {
            return "\(Self.shortDayFormatter.string(from: startDate))-\(Self.shortDayFormatter.string(from: endDate))"
        }

        return "\(Self.fullDayFormatter.string(from: startDate))-\(Self.fullDayFormatter.string(from: endDate))"
    }

    func shifted(by offset: Int) -> ScorePeriod {
        switch kind {
        case .year:
            let nextDate = Self.gregorian.date(byAdding: .year, value: offset, to: startDate) ?? startDate
            return ScorePeriod(kind: .year, date: nextDate)
        case .month:
            let nextDate = Self.gregorian.date(byAdding: .month, value: offset, to: startDate) ?? startDate
            return ScorePeriod(kind: .month, date: nextDate)
        case .week:
            let nextDate = Self.gregorian.date(byAdding: .day, value: offset * 7, to: startDate) ?? startDate
            return ScorePeriod(kind: .week, date: nextDate)
        }
    }

    func referenceDate(now: Date = Date()) -> Date {
        switch kind {
        case .year:
            let year = Self.gregorian.component(.year, from: startDate)
            let nowComponents = Self.gregorian.dateComponents([.month, .day], from: now)
            let month = nowComponents.month ?? 1
            let day = min(nowComponents.day ?? 1, Self.daysInMonth(year: year, month: month))
            return Self.date(year: year, month: month, day: day)
        case .month:
            let active = Self.gregorian.dateComponents([.year, .month], from: startDate)
            let current = Self.gregorian.dateComponents([.year, .month], from: now)
            if active.year == current.year && active.month == current.month {
                return now
            }
            return startDate
        case .week:
            return startDate
        }
    }

    func isFuture(comparedTo date: Date = Date()) -> Bool {
        startDate > ScorePeriod(kind: kind, date: date).startDate
    }

    static var gregorian: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = utc
        return calendar
    }

    static func date(year: Int, month: Int, day: Int) -> Date {
        gregorian.date(from: DateComponents(timeZone: utc, year: year, month: month, day: day)) ?? Date(timeIntervalSince1970: 0)
    }

    private static let utc = TimeZone(secondsFromGMT: 0)!

    private static var iso8601: Calendar {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = utc
        calendar.firstWeekday = 2
        calendar.minimumDaysInFirstWeek = 4
        return calendar
    }

    private static let monthFormatter = formatter("MMMM yyyy")
    private static let shortMonthFormatter = formatter("MMM yyyy")
    private static let shortDayFormatter = formatter("MMM d")
    private static let fullDayFormatter = formatter("MMM d, yyyy")

    private static func formatter(_ dateFormat: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = utc
        formatter.dateFormat = dateFormat
        return formatter
    }

    private static func isYear(_ value: String) -> Bool {
        value.range(of: #"^\d{4}$"#, options: .regularExpression) != nil
    }

    private static func isMonth(_ value: String) -> Bool {
        value.range(of: #"^\d{4}-(0[1-9]|1[0-2])$"#, options: .regularExpression) != nil
    }

    private static func isValidWeek(_ value: String) -> Bool {
        guard value.range(of: #"^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$"#, options: .regularExpression) != nil,
              let start = weekStart(for: value)
        else {
            return false
        }
        return weekPeriodString(for: start) == value
    }

    private static func weekStart(for period: String) -> Date? {
        let parts = period.components(separatedBy: "-W")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let week = Int(parts[1])
        else {
            return nil
        }

        return iso8601.date(from: DateComponents(
            calendar: iso8601,
            timeZone: utc,
            weekday: 2,
            weekOfYear: week,
            yearForWeekOfYear: year
        ))
    }

    private static func weekPeriodString(for date: Date) -> String {
        let components = iso8601.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return String(format: "%04d-W%02d", components.yearForWeekOfYear ?? 1970, components.weekOfYear ?? 1)
    }

    private static func daysInMonth(year: Int, month: Int) -> Int {
        let nextMonth = gregorian.date(byAdding: .month, value: 1, to: date(year: year, month: month, day: 1)) ?? date(year: year, month: month, day: 28)
        let lastDay = gregorian.date(byAdding: .day, value: -1, to: nextMonth) ?? nextMonth
        return gregorian.component(.day, from: lastDay)
    }
}

private enum ProfileChartSeries: CaseIterable, Identifiable {
    case commits
    case distance
    case score

    static let barSeries: [ProfileChartSeries] = [.commits, .distance]

    var id: String {
        switch self {
        case .commits:
            return "commits"
        case .distance:
            return "distance"
        case .score:
            return "score"
        }
    }

    var color: Color {
        switch self {
        case .commits:
            return Brand.green
        case .distance:
            return Brand.blue
        case .score:
            return Brand.orange
        }
    }

    var lineWidth: CGFloat {
        switch self {
        case .score:
            return 3
        case .commits, .distance:
            return 4
        }
    }

    var dash: [CGFloat] {
        []
    }

    func legendTitle(units: DistanceUnits) -> String {
        switch self {
        case .commits:
            return "Commits"
        case .distance:
            return units.abbreviation
        case .score:
            return "Score"
        }
    }

    func value(from point: ProfileHistoryPoint) -> Double {
        switch self {
        case .commits:
            return Double(point.commits)
        case .distance:
            return point.kilometers
        case .score:
            return point.score
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

enum MobileAuthPKCE {
    static func generate() throws -> (verifier: String, challenge: String) {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else { throw PacePushAPIError.keychain(status) }

        let verifier = Data(bytes).base64URLEncodedString()
        let digest = SHA256.hash(data: Data(verifier.utf8))
        let challenge = Data(digest).base64URLEncodedString()
        return (verifier, challenge)
    }
}

extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

enum BrandThemePreference: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system:
            return "System"
        case .light:
            return "Light"
        case .dark:
            return "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system:
            return nil
        case .light:
            return .light
        case .dark:
            return .dark
        }
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

    func leaderboardMetricTitle(units: DistanceUnits) -> String {
        switch self {
        case .balanced:
            return "Score"
        case .commits:
            return "Commits"
        case .distance:
            return "Run \(units.abbreviation)"
        }
    }

    func leaderboardMetric(for row: LeaderboardRow, units: DistanceUnits) -> LeaderboardMetric {
        switch self {
        case .balanced:
            return LeaderboardMetric(
                value: row.score.formatted(.number.precision(.fractionLength(1))),
                detail: "\(row.commits) commits / \(units.format(row.kilometers, includeUnit: true))",
                color: Brand.orange,
            )
        case .commits:
            return LeaderboardMetric(
                value: "\(row.commits)",
                detail: nil,
                color: Brand.green,
            )
        case .distance:
            return LeaderboardMetric(
                value: units.format(row.kilometers),
                detail: nil,
                color: Brand.blue,
            )
        }
    }
}

struct LeaderboardMetric {
    let value: String
    let detail: String?
    let color: Color
}

struct APIErrorResponse: Decodable {
    let error: String
}

struct MobileAuthExchangeRequest: Encodable {
    let code: String
    let codeVerifier: String
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

struct GitHubDisconnectResponse: Decodable {
    let login: String
    let disconnectedAt: String
}

struct AccountDeletionResponse: Decodable {
    let login: String
    let status: String
    let deletedAt: String
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

enum DemoData {
    static let primaryLogin = "demo-runner"

    private static let rows = [
        LeaderboardRow(rank: 1, login: primaryLogin, displayName: "Pace Review", score: 93.8, commits: 286, kilometers: 74.2, streakDays: 9),
        LeaderboardRow(rank: 2, login: "ship-sprint", displayName: "Sam Sprint", score: 88.1, commits: 341, kilometers: 52.7, streakDays: 6),
        LeaderboardRow(rank: 3, login: "run-merge", displayName: "Rina Merge", score: 81.6, commits: 164, kilometers: 91.5, streakDays: 8),
        LeaderboardRow(rank: 4, login: "commit-km", displayName: "Kai Commit", score: 76.4, commits: 226, kilometers: 44.9, streakDays: 4),
        LeaderboardRow(rank: 5, login: "lint-laps", displayName: "Lena Laps", score: 70.9, commits: 118, kilometers: 83.3, streakDays: 5),
    ]

    static func leaderboard(period: ScorePeriod, board: Board) -> LeaderboardResponse {
        LeaderboardResponse(period: period.rawValue, board: board, rows: rows(for: period))
    }

    static func me(period: ScorePeriod) -> MeResponse {
        let row = rows(for: period)[0]
        return MeResponse(
            login: row.login,
            displayName: row.displayName,
            publicLeaderboard: true,
            units: "metric",
            score: score(for: row, period: period),
            devices: []
        )
    }

    static func profile(login: String, period: ScorePeriod) -> PublicProfileResponse {
        let periodRows = rows(for: period)
        let row = periodRows.first { $0.login.localizedCaseInsensitiveCompare(login) == .orderedSame } ?? periodRows[0]
        return PublicProfileResponse(
            login: row.login,
            displayName: row.displayName,
            bio: "Sample App Review profile.",
            score: score(for: row, period: period),
            history: history(for: row, period: period)
        )
    }

    private static func rows(for period: ScorePeriod) -> [LeaderboardRow] {
        rows.map { row in
            let metrics = metrics(for: row, period: period)
            return LeaderboardRow(
                rank: row.rank,
                login: row.login,
                displayName: row.displayName,
                score: metrics.score,
                commits: metrics.commits,
                kilometers: metrics.kilometers,
                streakDays: metrics.streakDays
            )
        }
    }

    private static func score(for row: LeaderboardRow, period: ScorePeriod) -> ScoreSummary {
        ScoreSummary(
            period: period.rawValue,
            score: row.score,
            rank: row.rank,
            commits: row.commits,
            kilometers: row.kilometers,
            lastSyncAt: "2026-07-10T09:30:00.000Z"
        )
    }

    private static func history(for row: LeaderboardRow, period: ScorePeriod) -> [ProfileHistoryPoint] {
        let dates = historyDates(for: period)
        let fractions = progressFractions(count: dates.count)

        return zip(dates, fractions).map { date, fraction in
            ProfileHistoryPoint(
                date: date,
                commits: max(1, Int((Double(row.commits) * fraction).rounded())),
                kilometers: rounded(row.kilometers * fraction),
                score: rounded(row.score * fraction)
            )
        }
    }

    private static func metrics(for row: LeaderboardRow, period: ScorePeriod) -> LeaderboardRow {
        let seed = normalizedSeed(for: row.login, period: period)
        let components = ScorePeriod.gregorian.dateComponents([.year, .month], from: period.startDate)

        let commitScale: Double
        let distanceScale: Double
        let scoreScale: Double
        let streakScale: Double

        switch period.kind {
        case .week:
            commitScale = 0.16 + seed * 0.15
            distanceScale = 0.12 + (1 - seed) * 0.13
            scoreScale = 0.68 + seed * 0.22
            streakScale = 0.45 + seed * 0.2
        case .month:
            let month = Double(components.month ?? 1)
            let seasonality = Double(Int(month) % 4) * 0.045
            commitScale = 0.72 + seasonality + seed * 0.12
            distanceScale = 0.68 + (0.135 - seasonality) + (1 - seed) * 0.1
            scoreScale = 0.84 + seed * 0.13
            streakScale = 0.85 + seed * 0.15
        case .year:
            let year = components.year ?? 2026
            let age = Double(max(0, min(4, 2026 - year)))
            let recency = 1 - age * 0.08
            commitScale = (3.15 + seed * 0.7) * recency
            distanceScale = (3.6 + (1 - seed) * 0.85) * recency
            scoreScale = 0.88 + seed * 0.1 - age * 0.015
            streakScale = 1.35 + max(0, 4 - age) * 0.14
        }

        return LeaderboardRow(
            rank: row.rank,
            login: row.login,
            displayName: row.displayName,
            score: rounded(clamped(row.score * scoreScale, lower: 10, upper: 99.4)),
            commits: max(1, Int((Double(row.commits) * commitScale).rounded())),
            kilometers: rounded(row.kilometers * distanceScale),
            streakDays: max(1, Int((Double(row.streakDays) * streakScale).rounded()))
        )
    }

    private static func historyDates(for period: ScorePeriod) -> [String] {
        let dates: [Date]

        switch period.kind {
        case .week:
            dates = (0..<7).map { offset in
                ScorePeriod.gregorian.date(byAdding: .day, value: offset, to: period.startDate) ?? period.startDate
            }
        case .month:
            let components = ScorePeriod.gregorian.dateComponents([.year, .month], from: period.startDate)
            let year = components.year ?? 1970
            let month = components.month ?? 1
            let lastDay = ScorePeriod.gregorian.component(.day, from: period.endDate)
            let days = [1, 5, 10, 15, 20, 25, lastDay]
            dates = Array(Set(days.map { min($0, lastDay) })).sorted().map { day in
                ScorePeriod.date(year: year, month: month, day: day)
            }
        case .year:
            let year = ScorePeriod.gregorian.component(.year, from: period.startDate)
            dates = [
                ScorePeriod.date(year: year, month: 1, day: 31),
                ScorePeriod.date(year: year, month: 3, day: 31),
                ScorePeriod.date(year: year, month: 5, day: 31),
                ScorePeriod.date(year: year, month: 7, day: 31),
                ScorePeriod.date(year: year, month: 9, day: 30),
                ScorePeriod.date(year: year, month: 11, day: 30),
                ScorePeriod.date(year: year, month: 12, day: 31),
            ]
        }

        return dates.map(dayString)
    }

    private static func progressFractions(count: Int) -> [Double] {
        guard count > 0 else { return [] }
        return (0..<count).map { index in
            let progress = Double(index + 1) / Double(count)
            return min(1, pow(progress, 1.12))
        }
    }

    private static func normalizedSeed(for login: String, period: ScorePeriod) -> Double {
        let value = "\(login)-\(period.rawValue)".unicodeScalars.reduce(0) { partial, scalar in
            (partial * 31 + Int(scalar.value)) % 997
        }
        return Double(value % 100) / 99
    }

    private static func dayString(for date: Date) -> String {
        let components = ScorePeriod.gregorian.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02d",
            components.year ?? 1970,
            components.month ?? 1,
            components.day ?? 1
        )
    }

    private static func rounded(_ value: Double) -> Double {
        (value * 10).rounded() / 10
    }

    private static func clamped(_ value: Double, lower: Double, upper: Double) -> Double {
        min(max(value, lower), upper)
    }
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
    private static let orangeHex: UInt32 = 0xf97316

    static let paper = dynamicColor(light: 0xffffff, dark: 0x0d1117)
    static let surfaceBright = dynamicColor(light: 0xffffff, dark: 0x161b22)
    static let surfacePanel = dynamicColor(light: 0xf6f8fa, dark: 0x161b22)
    static let surfacePanelHigh = dynamicColor(light: 0xeaeef2, dark: 0x21262d)
    static let ink = dynamicColor(light: 0x1f2328, dark: 0xe6edf3)
    static let muted = dynamicColor(light: 0x59636e, dark: 0x8b949e)
    static let line = dynamicColor(light: 0xd0d7de, dark: 0x30363d)
    static let orange = Color(hex: orangeHex)
    static let green = dynamicColor(light: 0x1a7f37, dark: 0x3fb950)
    static let red = dynamicColor(light: 0xcf222e, dark: 0xff7b72)
    static let blue = dynamicColor(light: 0x0969da, dark: 0x58a6ff)
    static let yellow = dynamicColor(light: 0xfff8c5, dark: 0xd29922)
    static let borderWidth: CGFloat = 1
    static let cornerRadius: CGFloat = 6

    static let uiPaper = dynamicUIColor(light: 0xffffff, dark: 0x0d1117)
    static let uiSurfacePanel = dynamicUIColor(light: 0xf6f8fa, dark: 0x161b22)
    static let uiInk = dynamicUIColor(light: 0x1f2328, dark: 0xe6edf3)
    static let uiMuted = dynamicUIColor(light: 0x59636e, dark: 0x8b949e)
    static let uiOrange = UIColor(hex: orangeHex)

    private static func dynamicColor(light: UInt32, dark: UInt32) -> Color {
        Color(dynamicUIColor(light: light, dark: dark))
    }

    private static func dynamicUIColor(light: UInt32, dark: UInt32) -> UIColor {
        UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        }
    }
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
        let tabBarAppearance = UITabBarAppearance()
        tabBarAppearance.configureWithTransparentBackground()
        tabBarAppearance.backgroundColor = .clear
        tabBarAppearance.backgroundEffect = nil
        tabBarAppearance.shadowColor = .clear

        tabBar.standardAppearance = tabBarAppearance
        tabBar.scrollEdgeAppearance = tabBarAppearance
        tabBar.tintColor = Brand.uiInk
        tabBar.unselectedItemTintColor = Brand.uiMuted
        tabBar.barTintColor = .clear
        tabBar.backgroundColor = .clear
        tabBar.backgroundImage = UIImage()
        tabBar.shadowImage = UIImage()
        tabBar.isTranslucent = true

        UITableView.appearance().backgroundColor = Brand.uiPaper
        UITableViewCell.appearance().backgroundColor = Brand.uiSurfacePanel
        UITextField.appearance().textColor = Brand.uiInk
        UITextField.appearance().tintColor = Brand.uiInk
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .foregroundStyle(isEnabled ? Brand.ink : Brand.muted)
            .padding(14)
            .roundedBackground(buttonBackground(isPressed: configuration.isPressed))
            .roundedBorder()
    }

    private func buttonBackground(isPressed: Bool) -> Color {
        if !isEnabled {
            return Brand.muted.opacity(0.16)
        }

        return isPressed ? Brand.orange.opacity(0.72) : Brand.orange
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
    func roundedBackground(_ surface: Color) -> some View {
        background(RoundedRectangle(cornerRadius: Brand.cornerRadius).fill(surface))
    }

    func roundedBorder(
        _ stroke: Color = Brand.line,
        lineWidth: CGFloat = Brand.borderWidth
    ) -> some View {
        overlay(RoundedRectangle(cornerRadius: Brand.cornerRadius).stroke(stroke, lineWidth: lineWidth))
    }

    func roundedClip() -> some View {
        clipShape(RoundedRectangle(cornerRadius: Brand.cornerRadius))
    }

    func panelStyle(
        surface: Color = Brand.surfacePanel,
        stroke: Color = Brand.line,
        lineWidth: CGFloat = Brand.borderWidth
    ) -> some View {
        padding(18)
            .roundedBackground(surface)
            .roundedBorder(stroke, lineWidth: lineWidth)
    }

    func borderedRow() -> some View {
        overlay(Rectangle().frame(height: 1).foregroundStyle(Brand.line), alignment: .bottom)
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
