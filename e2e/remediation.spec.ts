import { enterHouseholdDemo } from "./household";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await enterHouseholdDemo(page);
});
const headers = { Origin: "http://localhost:3102" };
async function login(page: import("@playwright/test").Page) {
  await page.goto("/provider/login");
  await page.getByLabel("Email address").fill("admin@demo.pantryfit.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("PantryFit-demo-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);
}
test("empty directory allows its first listing, selection and midnight service details", async ({
  page,
}) => {
  let created = "";
  await page.route("**/api/providers", async (route) => {
    if (route.request().method() !== "GET") {
      const response = await route.fetch();
      if (response.ok()) created = (await response.json()).id;
      return route.fulfill({ response });
    }
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({
      response,
      json: {
        ...data,
        providers: data.providers.filter(
          (p: { id: string }) => p.id === created,
        ),
      },
    });
  });
  await login(page);
  await expect(
    page.getByText("The directory is empty. Add the first listing."),
  ).toBeVisible();
  await page.getByText("Add a listing", { exact: true }).click();
  for (const [name, value] of Object.entries({
    nameEn: "Midnight test listing",
    nameEs: "Registro de prueba",
    descriptionEn: "Fictional test",
    descriptionEs: "Prueba ficticia",
    addressEn: "Fictional location",
    addressEs: "Ubicación ficticia",
    sourceEn: "Test source",
    sourceEs: "Fuente de prueba",
    lat: "40.87",
    lng: "-73.89",
  }))
    await page.locator("input[name=" + name + "]").fill(value);
  await page
    .getByRole("button", { name: "Create listing", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: "Midnight test listing", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Add time window", exact: true })
    .click();
  await page.getByLabel("Start", { exact: true }).fill("22:00");
  await page.getByLabel("End of day (midnight)", { exact: true }).check();
  await page
    .getByLabel("Update note", { exact: true })
    .fill("Explicit midnight listing details");
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(
    page.getByText("Your update was submitted for administrator review.", {
      exact: true,
    }),
  ).toBeVisible();
  const account = await (await page.request.get("/api/auth/me")).json();
  const c = account.changes.find(
    (v: { programId: string }) => v.programId === created,
  );
  expect(c.payload.hours).toEqual([{ day: 0, start: 1320, end: 1440 }]);
  const approved = await page.request.patch("/api/changes/" + c.id, {
    headers,
    data: { status: "approved", note: "Explicit midnight details reviewed" },
  });
  expect(approved.ok()).toBe(true);
  await page.reload();
  await expect(
    page.getByLabel("End of day (midnight)", { exact: true }),
  ).toBeChecked();
});
test("rejects stale approvals and explicitly resubmits for a new review", async ({
  page,
}) => {
  await login(page);
  const directory = await (await page.request.get("/api/providers")).json();
  const p = directory.providers.find(
    (p: { id: string }) => p.id === "demo-garden",
  );
  const payload = {
    programId: p.id,
    baseRevision: p.revision || 0,
    baseOrganizationRevision: p.organizationRevision || 0,
    hours: p.program.hours,
    exceptions: p.program.exceptions,
    offerings: p.program.offerings,
    appointment: p.program.appointment,
    eligibility: p.program.eligibility,
    phone: "1111111111",
    note: "Older explicit stale proposal",
  };
  const a = await (
    await page.request.post("/api/changes", { headers, data: payload })
  ).json();
  const b = await (
    await page.request.post("/api/changes", {
      headers,
      data: {
        ...payload,
        phone: "2222222222",
        note: "Newer explicit proposal",
      },
    })
  ).json();
  expect(
    (
      await page.request.patch("/api/changes/" + b.id, {
        headers,
        data: { status: "approved", note: "Reviewed newer proposal" },
      })
    ).ok(),
  ).toBe(true);
  const stale = await page.request.patch("/api/changes/" + a.id, {
    headers,
    data: { status: "approved", note: "Attempt older proposal" },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error).toContain("Stale proposal");
  await page.reload();
  const card = page
    .locator(".change-card")
    .filter({ hasText: payload.note })
    .first();
  await card.getByText("View details", { exact: true }).click();
  await expect(
    card.getByText("Current published values", { exact: true }),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Resubmit proposed values for review" })
    .click();
  await expect(
    page.locator(".change-card").filter({ hasText: payload.note }),
  ).toHaveCount(2);
  const before = await (await page.request.get("/api/providers")).json();
  expect(
    before.providers.find((v: { id: string }) => v.id === p.id).phone,
  ).toBe("2222222222");
});
