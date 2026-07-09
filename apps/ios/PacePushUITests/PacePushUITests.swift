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

    func testSeededLaunchShowsProfileFirstAndSettings() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-uiTestingSeeded"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["period-selector"].exists)
        let tabBar = app.tabBars.firstMatch
        XCTAssertEqual(tabBar.buttons.element(boundBy: 0).label, "Profile")
        XCTAssertEqual(tabBar.buttons.element(boundBy: 1).label, "Board")
        XCTAssertEqual(tabBar.buttons.element(boundBy: 2).label, "Settings")
        XCTAssertFalse(tabBar.buttons["Today"].exists)
        XCTAssertFalse(tabBar.buttons["Sync"].exists)

        tabBar.buttons["Settings"].tap()

        XCTAssertTrue(app.descendants(matching: .any)["settings-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["sync-now-button"].exists)
        XCTAssertTrue(app.buttons["settings-sign-out-button"].exists)
        XCTAssertTrue(app.switches["settings-public-leaderboard-toggle"].exists)
        XCTAssertTrue(app.staticTexts["Theme"].exists)
        XCTAssertTrue(app.buttons["Light"].exists)
        XCTAssertTrue(app.buttons["Dark"].exists)
        XCTAssertFalse(app.staticTexts["Appearance"].exists)
        XCTAssertFalse(app.buttons["System"].exists)
        XCTAssertFalse(app.textFields["api-base-url-field"].isHittable)
    }

    func testReadyLaunchShowsProfileBeforeFirstSyncCompletes() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTestingReadyNoSync"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.descendants(matching: .any)["onboarding-view"].exists)
    }

    func testSeededProfileShowsPeriodSelectorAndChart() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-uiTestingSeeded"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["period-selector"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["profile-chart"].exists)
    }

    func testSeededLeaderboardRowOpensPublicProfile() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-uiTestingSeeded"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        app.tabBars.buttons["Board"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["leaderboard-screen"].waitForExistence(timeout: 5))
        let row = app.descendants(matching: .any)["leaderboard-row-noc2"]
        XCTAssertTrue(row.waitForExistence(timeout: 5))

        row.tap()

        XCTAssertTrue(app.descendants(matching: .any)["public-profile-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["@noc2"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["profile-chart"].exists)
    }

    func testPrivateLeaderboardShowsVisibilityNotice() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTestingPrivateLeaderboard"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        app.tabBars.buttons["Board"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["leaderboard-screen"].waitForExistence(timeout: 5))

        let notice = app.descendants(matching: .any)["private-leaderboard-notice"]
        XCTAssertTrue(notice.waitForExistence(timeout: 5))
        XCTAssertTrue(
            app.staticTexts["Your score is private. Select Public leaderboard in Settings to appear on this leaderboard."].exists
        )
    }
}
