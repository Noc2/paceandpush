import XCTest
@testable import PacePush

final class PacePushTests: XCTestCase {
    func testDistanceUnitAbbreviations() {
        XCTAssertEqual(DistanceUnits.metric.abbreviation, "km")
        XCTAssertEqual(DistanceUnits.imperial.abbreviation, "mi")
    }
}
