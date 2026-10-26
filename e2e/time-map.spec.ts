import { enterHouseholdDemo } from "./household";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { en } from "../src/lib/i18n";

test.beforeEach(async ({ page }) => {
  await enterHouseholdDemo(page);
});

test("custom maximum travel time and typed pickup hours survive navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/find");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("combobox", { name: en.maxTime, exact: true })
    .selectOption("45");
  await page
    .getByRole("spinbutton", {
      name: `${en.custom} (${en.minutes})`,
      exact: true,
    })
    .fill("37");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", {
      name: `${en.custom} (${en.minutes})`,
      exact: true,
    }),
  ).toHaveValue("37");
  await expect(
    page.getByRole("combobox", { name: en.maxTime, exact: true }),
  ).toHaveValue("37");
  await page
    .getByRole("spinbutton", {
      name: `${en.custom} (${en.minutes})`,
      exact: true,
    })
    .fill("181");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".error-message[role=alert]")).toContainText(
    "travel limit",
  );
  await page
    .getByRole("spinbutton", {
      name: `${en.custom} (${en.minutes})`,
      exact: true,
    })
    .fill("37");
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
    path: testInfo.outputPath("travel-time-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText(en.custom, { exact: true }).click();
  await page.getByLabel(en.start, { exact: true }).fill("10:15");
  await page.getByLabel(en.end, { exact: true }).fill("13:45");
  await page.getByRole("button", { name: en.addWindow, exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Mon 10:15–13:45/ }),
  ).toBeVisible();
});

test("map view explains unavailable locations without requesting external tiles", async ({
  page,
}, testInfo) => {
  let tileRequests = 0;
  await page.route("https://tile.openstreetmap.org/**", async (route) => {
    tileRequests++;
    await route.abort();
  });
  await page.goto("/results");
  await expect(
    page.getByRole("heading", { name: "Garden Table Pantry", exact: true }),
  ).toBeVisible();
  expect(tileRequests).toBe(0);
  await page.getByRole("button", { name: en.map, exact: true }).click();
  await expect(page.getByText(en.mapNote, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: en.map, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "Garden Table Pantry", exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(tileRequests).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath("map-notice-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
