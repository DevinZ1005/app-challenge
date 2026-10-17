import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => console.error(e.message));
await page.goto(process.env.BASE_URL || "http://localhost:3000", {
  waitUntil: "networkidle",
});
await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
await browser.close();
