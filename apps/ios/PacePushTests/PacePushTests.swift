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
}
