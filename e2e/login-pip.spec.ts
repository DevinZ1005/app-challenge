import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("opening login blocks forged sessions and rejects cross-origin sign-in", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to PantryFit" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Email address", { exact: true }),
  ).toBeDisabled();
  const denied = await request.post("/api/household/demo", {
    headers: { Origin: "https://evil.example" },
  });
  expect(denied.status()).toBe(403);
  await context.addCookies([
    {
      name: "pantryfit-household",
      value: "demo." + "a".repeat(43),
      url: "http://localhost:3102",
    },
  ]);
  for (const path of ["/find", "/results", "/providers/demo-garden"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("Pip asks questions, preserves editable replies, offers tips and signs out", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("welcome-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Meet Pip · Try the demo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/find$/);
  const cookie = (await context.cookies()).find(
    (c) => c.name === "pantryfit-household",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await expect(page.locator("#question-title")).toContainText("Hi, I’m Pip");
  await page.getByLabel("ZIP code", { exact: true }).fill("10467");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("10467");
  await page
    .getByRole("log")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await expect(page.getByLabel("ZIP code", { exact: true })).toHaveValue(
    "10467",
  );
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Find My Matches", exact: true })
    .click();
  await page
    .getByRole("button", { name: "An easy food idea?", exact: true })
    .click();
  await expect(page.locator(".pip-tips [role=status]")).toContainText(
    "No stove",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await context.addCookies([cookie]);
  await page.goto("/find");
  await expect(page).toHaveURL(/\/login$/);
});

test("Spanish welcome and Pip's conversation fit a phone and support accessible controls", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
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
  await expect(page.locator("#question-title")).toContainText(
    "¡Hola, soy Pip!",
  );
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("pip-mobile.png"),
    fullPage: true,
  });
});
