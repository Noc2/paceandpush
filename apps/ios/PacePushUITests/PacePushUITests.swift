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

        XCTAssertTrue(app.descendants(matching: .any)["leaderboard-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["period-selector"].exists)
        XCTAssertTrue(app.tabBars.buttons["Board"].exists)
        XCTAssertTrue(app.tabBars.buttons["Profile"].exists)
        XCTAssertTrue(app.tabBars.buttons["Settings"].exists)
        XCTAssertFalse(app.tabBars.buttons["Today"].exists)
        XCTAssertFalse(app.tabBars.buttons["Sync"].exists)

        app.tabBars.buttons["Settings"].tap()

        XCTAssertTrue(app.descendants(matching: .any)["settings-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["sync-now-button"].exists)
        XCTAssertTrue(app.textFields["api-base-url-field"].exists)
        XCTAssertTrue(app.switches["settings-public-leaderboard-toggle"].exists)
    }

    func testSeededProfileShowsPeriodSelectorAndChart() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-uiTestingSeeded"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["leaderboard-screen"].waitForExistence(timeout: 5))
        app.tabBars.buttons["Profile"].tap()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["period-selector"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["profile-chart"].exists)
    }
}
