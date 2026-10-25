import { enterHouseholdDemo } from "./household";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await enterHouseholdDemo(page);
});
import AxeBuilder from "@axe-core/playwright";

test("health, security headers, request validation, and private cache controls", async ({
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  expect(health.headers()["cache-control"]).toContain("no-store");
  expect(health.headers()["content-security-policy"]).toContain(
    "object-src 'none'",
  );
  expect(health.headers()["x-frame-options"]).toBe("DENY");
  const malformed = await request.post("/api/auth/login", {
    headers: {
      Origin: "http://localhost:3102",
      "Content-Type": "application/json",
    },
    data: "{",
  });
  expect(malformed.status()).toBe(400);
  const oversized = await request.post("/api/auth/login", {
    headers: {
      Origin: "http://localhost:3102",
      "Content-Type": "application/json",
    },
    data: "x".repeat(65537),
  });
  expect(oversized.status()).toBe(413);
  const crossOrigin = await request.post("/api/auth/login", {
    headers: { Origin: "https://unrelated.example" },
    data: {
      email: "provider@demo.pantryfit.test",
      password: "PantryFit-demo-2026",
    },
  });
  expect(crossOrigin.status()).toBe(403);
  const privateResponse = await request.get("/api/auth/me");
  expect(privateResponse.status()).toBe(401);
  expect(privateResponse.headers()["cache-control"]).toContain("no-store");
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Disallow: /",
  );
});

test("public routes and Spanish page have no automated accessibility violations", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const route of [
    "/",
    "/find",
    "/results",
    "/providers/demo-garden",
    "/provider/login",
    "/how-it-works",
    "/privacy",
    "/about",
    "/missing-page",
  ]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations, route).toEqual([]);
  }
  await page.goto("/find");
  await page.getByRole("button", { name: "Cambiar a español" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
