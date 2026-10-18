import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
const report = [];
for (const route of [
  "/",
  "/find",
  "/results",
  "/providers/demo-garden",
  "/provider/login",
  "/how-it-works",
  "/privacy",
]) {
  await page.goto((process.env.BASE_URL || "http://localhost:3000") + route, {
    waitUntil: "networkidle",
  });
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  report.push({ route, violations: result.violations });
  console.log(
    route,
    result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  );
}
// Audit the remaining questionnaire states, expanded explanations, Spanish, and staff forms.
async function scan(label) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  report.push({ route: label, violations: result.violations });
  console.log(
    label,
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  );
}
const base = process.env.BASE_URL || "http://localhost:3000";
await page.goto(base + "/find", { waitUntil: "networkidle" });
for (let step = 1; step < 6; step++) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await scan("/find step " + (step + 1));
}
await page.getByRole("button", { name: "Find My Matches" }).click();
await page.locator(".match-card summary").first().click();
await scan("/results expanded");
await page.getByRole("button", { name: "Cambiar a español" }).click();
await scan("/results Español");
await page.goto(base + "/provider/login", { waitUntil: "networkidle" });
await page.getByLabel("Email address").fill("provider@demo.pantryfit.test");
await page.getByLabel("Password", { exact: true }).fill("PantryFit-demo-2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/provider/dashboard");
await page.getByLabel("Update note", { exact: true }).waitFor();
await scan("/provider/dashboard authenticated");
await page.getByRole("button", { name: "Sign out" }).click();
await page.getByLabel("Email address").fill("admin@demo.pantryfit.test");
await page.getByLabel("Password", { exact: true }).fill("PantryFit-demo-2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/admin");
await page.getByRole("heading", { name: "Data quality review" }).waitFor();
await scan("/admin authenticated");
await writeFile(
  "artifacts/accessibility.json",
  JSON.stringify(report, null, 2),
);
await browser.close();
if (report.some((r) => r.violations.length)) process.exitCode = 1;
