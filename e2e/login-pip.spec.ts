import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { en, es } from "../src/lib/i18n";

test("welcome login rejects forged household sessions and cross-origin sign-in", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome to PantryFit" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Email address", { exact: true }),
  ).toBeDisabled();
  expect(
    (
      await request.post("/api/household/demo", {
        headers: { Origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
  await context.addCookies([
    {
      name: "pantryfit-household",
      value: "demo." + "a".repeat(43),
      url: "http://localhost:3102",
    },
  ]);
  await page.reload();
  // /find and /results are public in the current app. A forged cookie must not
  // become a valid household session or grant provider/administrator identity.
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome to PantryFit" }),
  ).toBeVisible();
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("household demo preserves editable answers and revokes its separate session on logout", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("/login");
  await page.screenshot({
    path: testInfo.outputPath("welcome-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Meet Pip · Try the demo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/find$/);
  const cookie = (await context.cookies()).find(
    (cookie) => cookie.name === "pantryfit-household",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await expect(page.locator("#question-title")).toContainText(en.locationTitle);
  await page.getByLabel(en.zip, { exact: true }).fill("10467");
  await page.getByRole("button", { name: en.next, exact: true }).click();
  await page.getByRole("button", { name: en.back, exact: true }).click();
  await expect(page.getByLabel(en.zip, { exact: true })).toHaveValue("10467");
  expect(
    (
      await page.request.post("/api/household/logout", {
        headers: { Origin: "http://localhost:3102" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === "pantryfit-household",
    ),
  ).toBe(false);
  await context.addCookies([cookie]);
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome to PantryFit" }),
  ).toBeVisible();
});

test("Spanish welcome and questionnaire fit a phone and provide accessible controls", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Cambiar a español" }).click();
  await expect(
    page.getByRole("heading", { name: "Te damos la bienvenida" }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: testInfo.outputPath("welcome-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Conoce a Pip · Prueba la demo" })
    .click();
  await expect(page).toHaveURL(/\/find\?lang=es$/);
  // The questionnaire's current language control is local to its page session.
  await page.getByRole("button", { name: "Cambiar a español" }).click();
  await expect(page.locator("#question-title")).toContainText(es.locationTitle);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("questionnaire-mobile.png"),
    fullPage: true,
  });
});
