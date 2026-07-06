import XCTest

final class PacePushUITests: XCTestCase {
    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    func testCleanLaunchShowsOnboardingControls() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["onboarding-view"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Set up Pace & Push"].exists)
        XCTAssertTrue(app.switches["public-leaderboard-toggle"].exists)
        XCTAssertTrue(app.buttons["confirm-public-leaderboard-button"].exists)
        XCTAssertTrue(app.buttons["connect-github-button"].exists)
        XCTAssertTrue(app.buttons["enable-health-button"].exists)
    }

    func testSeededLaunchShowsMainTabsAndSettings() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-uiTestingSeeded"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["today-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Your 2026-07 score"].exists)

        app.tabBars.buttons["Settings"].tap()

        XCTAssertTrue(app.descendants(matching: .any)["settings-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.textFields["api-base-url-field"].exists)
        XCTAssertTrue(app.switches["settings-public-leaderboard-toggle"].exists)
    }
}
