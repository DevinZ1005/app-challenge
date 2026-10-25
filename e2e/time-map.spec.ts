import { enterHouseholdDemo } from "./household";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await enterHouseholdDemo(page);
});
import AxeBuilder from "@axe-core/playwright";
test("custom travel ranges, dropdown examples and typed pickup hours survive navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/find");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("combobox", { name: "From", exact: true }).fill("12");
  await page.getByRole("button", { name: "To — presets", exact: true }).click();
  await page.getByRole("option", { name: "45", exact: true }).click();
  await page.getByRole("combobox", { name: "To", exact: true }).fill("37");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "From", exact: true }),
  ).toHaveValue("12");
  await expect(
    page.getByRole("combobox", { name: "To", exact: true }),
  ).toHaveValue("37");
  await page.getByRole("combobox", { name: "From", exact: true }).fill("50");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".error-message[role=alert]")).toContainText(
    "travel range",
  );
  await page.getByRole("combobox", { name: "From", exact: true }).fill("12");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: testInfo.outputPath("travel-range-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText("Custom time", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Start", exact: true })
    .fill("10:15 am");
  await page
    .getByRole("combobox", { name: "End", exact: true })
    .fill("1:45 pm");
  await page
    .getByRole("button", { name: "Add time window", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Mon 10:15–13:45/ }),
  ).toBeVisible();
});
test("route preview loads a selectable map only when requested and handles tile failure", async ({
  page,
}, testInfo) => {
  let tileRequests = 0;
  await page.route("https://tile.openstreetmap.org/**", async (route) => {
    tileRequests++;
    await route.abort();
  });
  await page.goto("/results");
  await expect(
    page.getByRole("heading", { name: "Approximate route", exact: true }),
  ).toBeVisible();
  expect(tileRequests).toBe(0);
  await expect(
    page.getByText("Fictional example", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Garden Table Pantry$/ }),
  ).toBeVisible();
  await expect.poll(() => tileRequests).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Garden Table Pantry$/ }).click();
  await expect(page.getByLabel("Preview a destination")).toHaveValue(
    "demo-garden",
  );
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    page.getByText("Map tiles could not load.", { exact: false }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("route-map-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
