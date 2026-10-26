import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("public mobile application is accessible and submits without an account", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  let submission: Record<string, unknown> | undefined;
  await page.route("**/api/provider-applications", async (route) => {
    submission = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { ok: true } });
  });
  await page.goto("/provider/login");
  await page
    .getByRole("link", { name: "Apply to represent an organization" })
    .click();
  await expect(page).toHaveURL(/\/provider\/apply$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  for (const [label, value] of [
    ["Organization name", "Synthetic Pantry"],
    ["Organization address", "Example pantry address, Bronx, NY"],
    ["Contact person's name", "Test Representative"],
    ["Contact email", "person@example.test"],
    [
      "Short organization description",
      "Synthetic community food assistance program for testing only.",
    ],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Application received for review" }),
  ).toBeVisible();
  expect(submission).toMatchObject({
    organizationName: "Synthetic Pantry",
    contactEmail: "person@example.test",
  });
  expect(submission).not.toHaveProperty("status");
  await expect(page).toHaveURL(/\/provider\/apply$/);
});
