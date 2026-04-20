import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("loads the English homepage", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/IranENovin/);
    await expect(page.locator("text=Build Iran's Future. Together.")).toBeVisible();
  });

  test("loads the Farsi homepage", async ({ page }) => {
    await page.goto("/fa");
    await expect(
      page.locator("text=آینده‌ای بهتر برای ایران، با هم بسازیم")
    ).toBeVisible();
  });

  test("navigation links are visible", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("nav >> text=Ideas")).toBeVisible();
    await expect(page.locator("nav >> text=Projects")).toBeVisible();
    await expect(page.locator("nav >> text=Members")).toBeVisible();
  });

  test("ideas feed loads", async ({ page }) => {
    await page.goto("/en");
    // Wait for ideas to load (either cards or "No ideas" message)
    await page.waitForSelector('[class*="grid"] >> div, text=No ideas', {
      timeout: 15000,
    });
  });

  test("sign in modal opens", async ({ page }) => {
    await page.goto("/en");
    await page.click("text=Sign In / Sign Up");
    await expect(page.locator("text=Continue with GitHub")).toBeVisible();
  });

  test("language switcher works", async ({ page }) => {
    await page.goto("/en");
    await page.click("text=FA");
    await expect(page).toHaveURL(/\/fa/);
  });

  test("ideas page loads", async ({ page }) => {
    await page.goto("/en/ideas");
    await expect(page.locator("h1")).toContainText("Ideas");
  });
});
