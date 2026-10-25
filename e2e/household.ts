import { expect, type Page } from "@playwright/test";
export async function enterHouseholdDemo(page: Page) {
  const response = await page.request.post("/api/household/demo", {
    headers: { Origin: "http://localhost:3102" },
  });
  expect(response.status()).toBe(200);
}
