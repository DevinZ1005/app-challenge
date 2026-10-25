import { enterHouseholdDemo } from "./household";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await enterHouseholdDemo(page);
});
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-19T12:00:00Z") });
});
test("household journey, language preservation, explanations, details, and editing", async ({
  page,
}) => {
  await page.goto("/find");
  await page.getByLabel("ZIP code").fill("10467");
  await page.getByRole("button", { name: "Cambiar a español" }).click();
  await expect(page.getByLabel("Código postal")).toHaveValue("10467");
  await page.getByRole("button", { name: "Switch to English" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Tuesday, Afternoon", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("No cooking equipment", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("No", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Find My Matches" }).click();
  await expect(page).toHaveURL(/\/results/);
  await expect(
    page.getByRole("heading", { name: "Garden Table Pantry", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Other services with known conflicts" }),
  ).toBeVisible();
  await page.locator(".match-card").first().locator("summary").click();
  await expect(
    page.getByText(
      "Pickup hours overlap with your availability in the next seven days.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "View details" }).first().click();
  await expect(page).toHaveURL(/\/providers\//);
  await expect(
    page.getByText("Directions are disabled for fictional locations."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to results" }).click();
  await page.getByRole("link", { name: "Edit preferences" }).click();
  await expect(page.getByLabel("ZIP code")).toHaveValue("10467");
});
test("invalid entries and mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Find Food", exact: true })
    .click();
  await page.getByLabel("ZIP code").fill("12");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".error-message[role=alert]")).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});

test("household answers and location stay in memory through matching and clear on reload", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 40.873456, longitude: -73.891234 });
  const apiRequests: { url: string; method: string; body: string | null }[] =
    [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push({
        url: request.url(),
        method: request.method(),
        body: request.postData(),
      });
  });
  await page.goto("/find");
  await page.getByLabel("ZIP code").fill("10467");
  await page
    .getByLabel("Nearby landmark", { exact: false })
    .fill("Private landmark marker");
  await page
    .getByRole("button", { name: "Use my current location", exact: true })
    .click();
  await expect(
    page.getByText("Location available for this session only.", {
      exact: true,
    }),
  ).toBeVisible();
  for (let step = 0; step < 5; step++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Find My Matches" }).click();
  await expect(page.locator(".match-card").first()).toBeVisible();
  expect(apiRequests.length).toBeGreaterThan(0);
  expect(
    apiRequests.every(
      (r) =>
        new URL(r.url).pathname === "/api/providers" &&
        r.method === "GET" &&
        !r.body &&
        !new URL(r.url).search,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
  await page
    .getByRole("link", { name: "Edit preferences", exact: true })
    .click();
  await expect(page.getByLabel("ZIP code")).toHaveValue("10467");
  await page.reload();
  await expect(page.getByLabel("ZIP code")).toHaveValue("10468");
  await expect(
    page.getByLabel("Nearby landmark", { exact: false }),
  ).toHaveValue("");
});

test("feedback failure preserves the report and a retry reaches administrator review", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/feedback", (route) =>
    fail ? route.abort() : route.continue(),
  );
  await page.goto("/about#feedback");
  const report = "Synthetic browser feedback regression";
  const field = page.locator("#feedback textarea");
  await field.fill(report);
  await page.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(page.locator("#feedback [role=status]")).toBeVisible();
  await expect(field).toHaveValue(report);
  fail = false;
  await page.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(
    page.getByText("Thank you. Your report was saved for review.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(field).toHaveValue("");
  await page.goto("/provider/login");
  await page.getByLabel("Email address").fill("admin@demo.pantryfit.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("PantryFit-demo-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText(report, { exact: false })).toBeVisible();
});
test("server rejects anonymous and cross-organization writes; authenticated approval publishes", async ({
  page,
  request,
}) => {
  const payload = {
    programId: "demo-garden",
    hours: [{ day: 1, start: 780, end: 1050 }],
    exceptions: [],
    offerings: null,
    appointment: "no",
    eligibility: null,
    phone: null,
    note: "E2E proposed afternoon pickup update",
  };
  const headers = { Origin: "http://localhost:3102" };
  const denied = await request.post("/api/changes", { headers, data: payload });
  expect(denied.status()).toBe(401);
  await page.goto("/provider/login");
  await page.getByLabel("Email address").fill("provider@demo.pantryfit.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("PantryFit-demo-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/provider\/dashboard/);
  const wrong = await page.request.post("/api/changes", {
    headers,
    data: { ...payload, programId: "demo-community" },
  });
  expect(wrong.status()).toBe(403);
  await page.getByLabel("End", { exact: true }).first().fill("17:30");
  await page.getByLabel("Update note", { exact: true }).fill(payload.note);
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(
    page.getByText("Your update was submitted for administrator review.", {
      exact: true,
    }),
  ).toBeVisible();
  const submitted = await page.request
    .get("/api/auth/me")
    .then((r) => r.json());
  const { id } = submitted.changes.find(
    (c: { payload: { note: string } }) => c.payload.note === payload.note,
  );
  const nonAdmin = await page.request.patch("/api/changes/" + id, {
    headers,
    data: { status: "approved", note: "Unauthorized approval attempt" },
  });
  expect(nonAdmin.status()).toBe(403);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email address").fill("admin@demo.pantryfit.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("PantryFit-demo-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);
  const reviewCard = page
    .locator(".change-card")
    .filter({ hasText: payload.note })
    .first();
  await reviewCard
    .getByLabel("Verification or review note")
    .fill("Reviewed the fictional test proposal");
  await reviewCard
    .getByRole("button", { name: "Approve", exact: true })
    .click();
  await expect(reviewCard.locator(".status-pill")).toHaveText("Approved");
  const published = await request.get("/api/providers").then((r) => r.json());
  expect(
    published.providers.find((p: { id: string }) => p.id === "demo-garden")
      .program.hours[0].end,
  ).toBe(1050);
  const duplicate = await page.request.patch("/api/changes/" + id, {
    headers,
    data: { status: "approved", note: "Duplicate approval must be rejected" },
  });
  expect(duplicate.status()).toBe(409);
});
