import Foundation
import SwiftUI

@main
struct PacePushApp: App {
    @StateObject private var store = PacePushStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var store: PacePushStore

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
        .tint(Brand.gold)
        .task {
            await store.refresh()
        }
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
                        Text("Your July score")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Brand.ink.opacity(0.62))
                            .textCase(.uppercase)

                        Text(store.me.score.score.formatted(.number.precision(.fractionLength(1))))
                            .font(.system(size: 72, weight: .black, design: .rounded))
                            .foregroundStyle(Brand.ink)

                        Text("Rank \(store.me.score.rank ?? 0) this month.")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(Brand.ink.opacity(0.72))
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
                        MetricTile(title: "Board", value: "#\(store.me.score.rank ?? 0)", color: Brand.blue)
                        MetricTile(title: "Sync", value: store.me.score.lastSyncAt == nil ? "Never" : "Ready", color: Brand.ink)
                    }
                }
                .padding(20)
            }
            .background(Brand.paper)
        }
    }
}

struct LeaderboardView: View {
    @EnvironmentObject private var store: PacePushStore
    @State private var board = Board.balanced

    var rows: [LeaderboardRow] {
        switch board {
        case .balanced:
            return store.leaderboard.rows.sorted { $0.score > $1.score }
        case .commits:
            return store.leaderboard.rows.sorted { $0.commits > $1.commits }
        case .distance:
            return store.leaderboard.rows.sorted { $0.kilometers > $1.kilometers }
        }
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

                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    LeaderboardRowView(rank: index + 1, row: row, units: store.units)
                        .listRowBackground(Brand.paper)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Brand.paper)
            .navigationTitle("Leaderboard")
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
                            .foregroundStyle(Brand.ink.opacity(0.68))

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
                                        .foregroundStyle(Brand.ink.opacity(0.62))
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
    @State private var pairingCode = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HeaderView()

                    VStack(alignment: .leading, spacing: 12) {
                        Label("Connect this device", systemImage: "iphone.gen3")
                            .font(.title3.bold())

                        TextField("Paste pairing code", text: $pairingCode)
                            .font(Font.system(.body, design: .monospaced))
                            .padding(14)
                            .background(Brand.paper)
                            .overlay(Rectangle().stroke(Brand.ink, lineWidth: 2))

                        Button {
                            store.deviceToken = pairingCode.isEmpty ? nil : "paired"
                        } label: {
                            Label("Pair", systemImage: "link")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PrimaryButtonStyle())

                        Text(store.deviceToken == nil ? "Waiting for a web pairing code." : "Device paired for local sync.")
                            .font(.callout.weight(.semibold))
                            .foregroundStyle(Brand.ink.opacity(0.68))
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
                Section("Server") {
                    TextField("API base URL", text: $store.apiBaseURL)
                        .font(Font.system(.body, design: .monospaced))
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
                    Toggle("Public leaderboard", isOn: .constant(store.me.publicLeaderboard))
                    Text("Running distance summaries are synced by day for the PoC.")
                }
            }
            .navigationTitle("Settings")
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
                .background(Brand.gold)
                .overlay(Rectangle().stroke(Brand.ink, lineWidth: 3))

            VStack(alignment: .leading, spacing: 2) {
                Text("Pace & Push")
                    .font(.title.bold())
                Text("Healthy body, shipped code.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Brand.ink.opacity(0.62))
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
                .foregroundStyle(Brand.ink.opacity(0.62))
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
                    .foregroundStyle(Brand.ink.opacity(0.62))
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(row.score.formatted(.number.precision(.fractionLength(1))))
                    .font(.headline.monospaced())
                    .foregroundStyle(Brand.blue)
                Text(units.format(row.kilometers, includeUnit: true))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Brand.ink.opacity(0.62))
            }
        }
        .padding(.vertical, 8)
    }
}

@MainActor
final class PacePushStore: ObservableObject {
    private let unitsKey = "distanceUnits"

    @Published var leaderboard = LeaderboardResponse.seed
    @Published var me = MeResponse.seed
    @Published var profile = PublicProfileResponse.seed
    @Published var apiBaseURL = "https://paceandpush.com"
    @Published var deviceToken: String?
    @Published var lastError: String?
    @Published var units: DistanceUnits {
        didSet {
            UserDefaults.standard.set(units.rawValue, forKey: unitsKey)
        }
    }

    init() {
        let savedUnits = UserDefaults.standard.string(forKey: unitsKey)
        units = DistanceUnits(rawValue: savedUnits ?? "") ?? .metric
    }

    func refresh() async {
        guard let baseURL = URL(string: apiBaseURL) else { return }

        do {
            async let leaderboardResponse: LeaderboardResponse = fetch("/api/leaderboard", baseURL: baseURL)
            async let meResponse: MeResponse = fetch("/api/me", baseURL: baseURL)
            async let profileResponse: PublicProfileResponse = fetch("/api/users/Noc2", baseURL: baseURL)
            leaderboard = try await leaderboardResponse
            me = try await meResponse
            profile = try await profileResponse
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func formatDistance(_ kilometers: Double, includeUnit: Bool = false) -> String {
        units.format(kilometers, includeUnit: includeUnit)
    }

    private func fetch<T: Decodable>(_ path: String, baseURL: URL) async throws -> T {
        let url = baseURL.appending(path: path)
        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(T.self, from: data)
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

struct LeaderboardResponse: Decodable {
    let period: String
    let board: Board
    let rows: [LeaderboardRow]

    static let seed = LeaderboardResponse(
        period: "2026-07",
        board: .balanced,
        rows: [
            LeaderboardRow(rank: 1, login: "Noc2", displayName: "David Hawig", score: 94.2, commits: 312, kilometers: 86.4, streakDays: 11),
            LeaderboardRow(rank: 2, login: "alina-dev", displayName: "Alina Roth", score: 88.7, commits: 244, kilometers: 97.8, streakDays: 8),
            LeaderboardRow(rank: 3, login: "mjansen", displayName: "Mika Jansen", score: 77.1, commits: 178, kilometers: 73.2, streakDays: 5)
        ]
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

    static let seed = MeResponse(
        login: "Noc2",
        displayName: "David Hawig",
        publicLeaderboard: true,
        units: "metric",
        score: ScoreSummary(period: "2026-07", score: 94.2, rank: 1, commits: 312, kilometers: 86.4, lastSyncAt: nil)
    )
}

struct PublicProfileResponse: Decodable {
    let login: String
    let displayName: String
    let bio: String?
    let score: ScoreSummary
    let history: [ProfileHistoryPoint]

    static let seed = PublicProfileResponse(
        login: "Noc2",
        displayName: "David Hawig",
        bio: "Healthy body, shipped code.",
        score: MeResponse.seed.score,
        history: [
            ProfileHistoryPoint(date: "2026-07-01", commits: 41, kilometers: 8.1, score: 42.8),
            ProfileHistoryPoint(date: "2026-07-02", commits: 93, kilometers: 23.5, score: 68.4),
            ProfileHistoryPoint(date: "2026-07-03", commits: 128, kilometers: 31.2, score: 75.6)
        ]
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
    static let paper = Color(hex: 0xf8f2e6)
    static let ink = Color(hex: 0x211e1a)
    static let gold = Color(hex: 0xf7c948)
    static let green = Color(hex: 0x24a148)
    static let red = Color(hex: 0xfa4d36)
    static let blue = Color(hex: 0x0f62fe)
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .foregroundStyle(Brand.ink)
            .padding(14)
            .background(configuration.isPressed ? Brand.gold.opacity(0.72) : Brand.gold)
            .overlay(Rectangle().stroke(Brand.ink, lineWidth: 2))
    }
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
