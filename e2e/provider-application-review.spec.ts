import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { en } from "../src/lib/i18n";

for (const width of [390, 1280])
  test(`administrator review works accessibly at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const application = {
      id: "synthetic-id",
      organizationName: "Synthetic Review Pantry",
      organizationAddress: "Example address, Bronx, NY",
      contactName: "Test Representative",
      contactEmail: "person@example.test",
      contactPhone: null,
      organizationWebsite: null,
      description: "Synthetic food assistance service for browser tests.",
      status: "pending",
      createdAt: "2025-01-01T12:00:00Z",
      reviewedAt: null as string | null,
      reviewedBy: null as string | null,
      reviewNote: null as string | null,
      verification: null,
    };
    let posts = 0;
    // Only the review API is mocked. Real demo login and the existing dashboard remain exercised.
    await page.route("**/api/admin/provider-applications**", async (route) => {
      if (route.request().method() === "POST") {
        posts++;
        application.status = "rejected";
        application.reviewedAt = "2025-01-02T12:00:00Z";
        application.reviewedBy = "synthetic-admin";
        application.reviewNote = route.request().postDataJSON().note;
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({
        json: new URL(route.request().url()).searchParams.has("status")
          ? { applications: [application], total: 1 }
          : application,
      });
    });
    await page.goto("/provider/login");
    await page.getByLabel("Email address").fill("admin@demo.pantryfit.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("PantryFit-demo-2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    const section = page.getByRole("region", {
      name: en.reviewApplicationsTitle,
    });
    await section
      .getByRole("button", {
        name: `${en.reviewOpen}: ${application.organizationName}`,
      })
      .click();
    await expect(section.getByText(application.contactEmail)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() =>
        [...document.querySelectorAll("main *")]
          .map((element) => ({
            tag: element.tagName,
            className: element.className,
            right: element.getBoundingClientRect().right,
          }))
          .filter((element) => element.right > innerWidth + 0.5),
      ),
    ).toEqual([]);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(width);
    await section
      .getByRole("button", { name: en.approve, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(en.reviewOfficialSource)).toBeVisible();
    await expect(dialog.getByLabel(en.reviewAttestation)).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    expect(posts).toBe(0);
    await section.getByRole("button", { name: en.reject, exact: true }).click();
    await dialog
      .getByLabel(en.reviewReason)
      .fill("Synthetic application could not be independently verified.");
    await dialog.getByRole("button", { name: en.reviewConfirmReject }).click();
    await expect(section.getByText(en.reviewSaved)).toBeVisible();
    await expect(section.getByText(en.reviewFinal)).toBeVisible();
    await expect(
      section.getByRole("button", { name: en.approve, exact: true }),
    ).toHaveCount(0);
    expect(posts).toBe(1);
    expect(
      (
        await new AxeBuilder({ page })
          .include("[aria-labelledby='provider-application-review-heading']")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
