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
        XCTAssertFalse(app.staticTexts["Sample data"].exists)
    }

    func testTryDemoOpensSampleAppAndCanExit() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["onboarding-view"].waitForExistence(timeout: 5))
        app.buttons["try-demo-button"].tap()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["@demo-runner"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["profile-chart"].exists)
        XCTAssertTrue(app.buttons["demo-exit-banner-button"].exists)
        XCTAssertFalse(app.staticTexts["Demo data"].exists)

        let tabBar = app.tabBars.firstMatch
        tabBar.buttons["Board"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["leaderboard-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["leaderboard-row-demo-runner"].exists)
        XCTAssertTrue(app.buttons["demo-exit-banner-button"].exists)
        XCTAssertFalse(app.staticTexts["Demo data"].exists)

        tabBar.buttons["Settings"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["settings-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["demo-exit-banner-button"].exists)
        XCTAssertFalse(app.buttons["settings-exit-demo-button"].exists)
        XCTAssertFalse(app.buttons["settings-demo-connect-github-button"].exists)
        XCTAssertFalse(app.buttons["settings-connect-github-button"].exists)
        XCTAssertFalse(app.buttons["settings-export-data-button"].exists)
        XCTAssertFalse(app.buttons["settings-delete-account-button"].exists)

        app.buttons["demo-exit-banner-button"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["onboarding-view"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["try-demo-button"].exists)
    }

    func testDemoPeriodChangesUpdateProfileMetrics() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["onboarding-view"].waitForExistence(timeout: 5))
        app.buttons["try-demo-button"].tap()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        let scoreValue = app.staticTexts["profile-score-value"]
        let commitsValue = app.staticTexts["profile-commits-value"]
        let distanceValue = app.staticTexts["profile-distance-value"]
        XCTAssertTrue(scoreValue.waitForExistence(timeout: 5))
        XCTAssertTrue(commitsValue.waitForExistence(timeout: 5))
        XCTAssertTrue(distanceValue.waitForExistence(timeout: 5))

        let monthScore = scoreValue.label
        let monthCommits = commitsValue.label
        let monthDistance = distanceValue.label

        app.buttons["Years"].tap()
        XCTAssertTrue(waitForLabelChange(scoreValue, from: monthScore))
        XCTAssertTrue(waitForLabelChange(commitsValue, from: monthCommits))
        XCTAssertTrue(waitForLabelChange(distanceValue, from: monthDistance))

        let currentYearScore = scoreValue.label
        let currentYearCommits = commitsValue.label
        let currentYearDistance = distanceValue.label

        app.buttons["Back"].tap()
        XCTAssertTrue(waitForLabelChange(scoreValue, from: currentYearScore))
        XCTAssertTrue(waitForLabelChange(commitsValue, from: currentYearCommits))
        XCTAssertTrue(waitForLabelChange(distanceValue, from: currentYearDistance))
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
        XCTAssertFalse(app.staticTexts["Account"].exists)
        XCTAssertFalse(app.staticTexts["Developer"].exists)
        XCTAssertTrue(app.buttons["settings-privacy-policy-link"].exists)
        XCTAssertTrue(app.buttons["settings-export-data-button"].exists)
        XCTAssertTrue(app.buttons["settings-delete-account-button"].exists)
        XCTAssertTrue(app.staticTexts["Theme"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["settings-theme-selector"].exists)
        let lightThemeButton = app.descendants(matching: .any)["settings-theme-light-button"]
        let darkThemeButton = app.descendants(matching: .any)["settings-theme-dark-button"]
        XCTAssertTrue(lightThemeButton.exists)
        XCTAssertTrue(darkThemeButton.exists)
        let themeSelectionValues = [
            lightThemeButton.value as? String,
            darkThemeButton.value as? String,
        ]
        XCTAssertEqual(themeSelectionValues.filter { $0 == "Selected" }.count, 1)
        XCTAssertEqual(themeSelectionValues.filter { $0 == "Not selected" }.count, 1)
        app.buttons["Dark"].tap()
        XCTAssertEqual(darkThemeButton.value as? String, "Selected")
        addSettingsScreenshot(from: app)
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
        let boardTab = app.tabBars.buttons["Board"]
        XCTAssertTrue(boardTab.waitForExistence(timeout: 5))
        boardTab.tap()
        XCTAssertTrue(app.descendants(matching: .any)["leaderboard-screen"].waitForExistence(timeout: 5))

        let notice = app.descendants(matching: .any)["private-leaderboard-notice"]
        XCTAssertTrue(notice.waitForExistence(timeout: 5))
        XCTAssertTrue(
            app.staticTexts["Your score is private. Select Public leaderboard in Settings to appear on this leaderboard."].exists
        )
    }

    private func addSettingsScreenshot(from app: XCUIApplication) {
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Settings - Theme"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }

    private func waitForLabelChange(_ element: XCUIElement, from oldValue: String, timeout: TimeInterval = 5) -> Bool {
        let predicate = NSPredicate(format: "label != %@", oldValue)
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }
}
