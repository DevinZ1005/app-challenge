import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoProviders } from "../src/lib/data";

for (const width of [390, 1280])
  test(`address directions work across pantry views at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const address = "3101 Kingsbridge Terrace, Bronx, NY 10463";
    const provider = {
      ...structuredClone(demoProviders[0]),
      id: "khcc-directions-test",
      demo: false,
      name: {
        en: "Kingsbridge Heights Community Center",
        es: "Centro Comunitario Kingsbridge Heights (KHCC)",
      },
      address: { en: address, es: address },
      coordinatesVerified: false,
    };
    // KHCC's public address was verified read-only; browser data is isolated.
    await page.route("**/api/providers", (route) =>
      route.fulfill({
        json: { providers: [provider], demo: false, demoAuth: true },
      }),
    );
    await context.route("https://www.google.com/maps/dir/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Intercepted directions</title>",
      }),
    );
    let locationRequested = false;
    page.on("console", (message) => {
      if (message.text() === "directions-geolocation-request")
        locationRequested = true;
    });
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = () => {
        console.log("directions-geolocation-request");
      };
      navigator.geolocation.watchPosition = () => {
        console.log("directions-geolocation-request");
        return 0;
      };
    });
    const expected = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    for (const path of ["/", "/results", `/providers/${provider.id}`]) {
      await page.goto(path);
      const link = page.getByRole("link", {
        name: "Get Directions",
        exact: true,
      });
      await expect(link).toHaveAttribute("href", expected);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBe(width);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    const popupPromise = page.waitForEvent("popup");
    await page
      .getByRole("link", { name: "Get Directions", exact: true })
      .click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    expect(popup.url()).toBe(expected);
    expect(await popup.evaluate(() => window.opener === null)).toBe(true);
    await popup.close();
    await page.getByRole("button", { name: "Cambiar a español" }).click();
    await expect(
      page.getByRole("link", { name: "Cómo llegar", exact: true }),
    ).toHaveAttribute("href", expected);
    expect(locationRequested).toBe(false);
  });
