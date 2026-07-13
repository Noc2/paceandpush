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
        XCTAssertTrue(app.buttons["connect-github-button"].exists)
        XCTAssertTrue(app.buttons["enable-health-button"].exists)
        XCTAssertTrue(app.buttons["publish-health-totals-button"].exists)
        XCTAssertTrue(app.buttons["keep-health-totals-private-button"].exists)
        let historyToggle = app.switches["public-activity-history-toggle"]
        XCTAssertTrue(historyToggle.exists)
        XCTAssertEqual(historyToggle.value as? String, "0")
        let healthDisclosure = app.staticTexts["onboarding-step-2-detail"]
        XCTAssertTrue(healthDisclosure.exists)
        XCTAssertEqual(
            healthDisclosure.label,
            "Pace & Push reads running workouts and uploads daily distance aggregates to calculate your totals and score. Your initial sync stays private; raw workouts and routes are never uploaded."
        )
        XCTAssertTrue(app.staticTexts["Profile visibility"].exists)
        XCTAssertTrue(app.staticTexts["Publishing makes these details visible to anyone, even without an account."].exists)
        XCTAssertTrue(app.descendants(matching: .any)["public-profile-field-summary"].exists)
        XCTAssertFalse(app.staticTexts["Optional public sharing"].exists)
        XCTAssertFalse(app.staticTexts["Sample data"].exists)
    }

    func testReadyToPublishCanKeepProfilePrivate() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTestingReadyToPublish"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["onboarding-view"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Profile visibility"].exists)
        let historyToggle = app.switches["public-activity-history-toggle"]
        XCTAssertTrue(historyToggle.exists)
        XCTAssertEqual(historyToggle.value as? String, "0")

        let keepPrivateButton = app.buttons["keep-health-totals-private-button"]
        XCTAssertTrue(keepPrivateButton.exists)
        for _ in 0..<4 where !keepPrivateButton.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(keepPrivateButton.isEnabled)
        XCTAssertTrue(keepPrivateButton.isHittable)
        keepPrivateButton.tap()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
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
        XCTAssertFalse(app.staticTexts["Exact totals public"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["public-profile-field-summary"].exists)
        XCTAssertFalse(app.staticTexts["Optional public sharing"].exists)
        let historyToggle = app.switches["public-activity-history-toggle"]
        XCTAssertTrue(historyToggle.exists)
        XCTAssertEqual(historyToggle.value as? String, "1")
        XCTAssertTrue(app.buttons["settings-update-public-sharing-button"].exists)
        XCTAssertTrue(app.buttons["settings-make-profile-private-button"].exists)
        XCTAssertFalse(app.switches["settings-public-leaderboard-toggle"].exists)
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

    func testReadyLaunchStaysInPrivateSetupUntilFirstSyncCompletes() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTestingReadyNoSync"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["onboarding-view"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.descendants(matching: .any)["profile-screen"].exists)
        XCTAssertTrue(app.buttons["publish-health-totals-button"].exists)
    }

    func testSeededProfileShowsPeriodSelectorAndChart() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-uiTestingSeeded"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["period-selector"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["profile-chart"].exists)
    }

    func testSeededSlowPeriodChangeUpdatesProfileMetrics() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-uiTestingSeeded", "-uiTestingSlowPeriodRefresh"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        let scoreValue = app.staticTexts["profile-score-value"]
        let commitsValue = app.staticTexts["profile-commits-value"]
        let distanceValue = app.staticTexts["profile-distance-value"]
        XCTAssertTrue(scoreValue.waitForExistence(timeout: 5))
        XCTAssertTrue(commitsValue.waitForExistence(timeout: 5))
        XCTAssertTrue(distanceValue.waitForExistence(timeout: 5))

        let initialScore = scoreValue.label
        let initialCommits = commitsValue.label
        let initialDistance = distanceValue.label

        app.buttons["Years"].tap()

        XCTAssertTrue(waitForLabelChange(scoreValue, from: initialScore))
        XCTAssertTrue(waitForLabelChange(commitsValue, from: initialCommits))
        XCTAssertTrue(waitForLabelChange(distanceValue, from: initialDistance))
        XCTAssertFalse(app.descendants(matching: .any)["profile-period-loading"].exists)
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
            app.staticTexts["Your score is private. Choose Publish exact totals in Settings to appear on this leaderboard."].exists
        )

        app.tabBars.buttons["Settings"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["settings-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Private"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["public-profile-field-summary"].exists)
        let historyToggle = app.switches["public-activity-history-toggle"]
        XCTAssertTrue(historyToggle.exists)
        XCTAssertEqual(historyToggle.value as? String, "0")
        XCTAssertTrue(app.buttons["settings-publish-health-totals-button"].exists)
    }

    func testCaptureAppStoreScreenshots() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["onboarding-view"].waitForExistence(timeout: 5))
        addScreenshot(named: "01-onboarding", from: app)

        app.buttons["try-demo-button"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        addScreenshot(named: "02-profile", from: app)

        let tabBar = app.tabBars.firstMatch
        tabBar.buttons["Board"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["leaderboard-screen"].waitForExistence(timeout: 5))
        addScreenshot(named: "03-leaderboard", from: app)

        tabBar.buttons["Settings"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["settings-screen"].waitForExistence(timeout: 5))
        addScreenshot(named: "04-settings", from: app)

        app.terminate()
        app.launchArguments = [
            "-uiTesting",
            "-uiTestingAppStoreScreenshots",
            "-AppleLanguages",
            "(en)",
            "-AppleLocale",
            "en_US",
        ]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["profile-screen"].waitForExistence(timeout: 5))
        app.tabBars.buttons["Board"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["leaderboard-screen"].waitForExistence(timeout: 5))
        let publicProfileRow = app.descendants(matching: .any)["leaderboard-row-sample-builder"]
        XCTAssertTrue(publicProfileRow.waitForExistence(timeout: 5))
        publicProfileRow.tap()
        XCTAssertTrue(app.descendants(matching: .any)["public-profile-screen"].waitForExistence(timeout: 5))
        addScreenshot(named: "05-public-profile", from: app)
    }

    private func addScreenshot(named name: String, from app: XCUIApplication) {
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = name
        screenshot.lifetime = .keepAlways
        add(screenshot)
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
