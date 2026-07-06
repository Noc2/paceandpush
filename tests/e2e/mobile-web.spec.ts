import { expect, test } from "@playwright/test";

const iosStoreUrl = "https://example.com/pace-push-ios-beta";

test.describe("mobile public web app", () => {
  test("opens the leaderboard-first mobile surface", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Pace & Push" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pace & Push leaderboard" })).toBeAttached();
    await expect(page.getByRole("navigation", { name: "Download apps" })).toBeVisible();
    await expect(page.getByRole("button", { name: "iPhone" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Android" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Period type" }).first()).toBeVisible();
    await expect(page.getByRole("table", { name: "Leaderboard" })).toBeVisible();
    await expect(page.getByText("No public scores yet")).toBeVisible();
  });

  test("keeps search and period controls usable on iPhone", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("searchbox", { name: "Search" }).fill("a");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL(/q=a/);
    await expect(page.getByText("Keep typing")).toBeVisible();

    await page.getByRole("link", { name: "Month" }).first().click();
    await expect(page).toHaveURL(/period=\d{4}-\d{2}/);
    await expect(page.getByRole("table", { name: "Search results" })).toBeVisible();
  });

  test("opens the iPhone download modal with QR code and store link", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "iPhone" }).click();

    const dialog = page.getByRole("dialog", { name: "iPhone app" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("App Store")).toBeVisible();
    await expect(dialog.getByText(iosStoreUrl)).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Open" })).toHaveAttribute("href", iosStoreUrl);
    await expect(dialog.getByAltText("iPhone app download QR code")).toBeVisible();

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  });
});
