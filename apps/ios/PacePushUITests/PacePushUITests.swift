import XCTest

final class PacePushUITests: XCTestCase {
    func testAppLaunchesToPacePushShell() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()

        XCTAssertTrue(app.staticTexts["Pace & Push"].waitForExistence(timeout: 5))
    }
}
