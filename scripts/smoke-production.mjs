import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { chromium, expect } from "@playwright/test";

const directory = await mkdtemp(join(tmpdir(), "pantryfit-production-smoke-"));
const port = process.env.SMOKE_PORT || "3101";
const origin = `http://127.0.0.1:${port}`;
async function checkBrowser() {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Simulate untrusted markup in an HTML response. strict-dynamic deliberately
    // trusts scripts created by trusted JS, so automation eval is not an XSS test.
    await page.route("**/find", async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        "<head>",
        "<head><script data-csp-test>window.pantryfitInjected = true</script>",
      );
      await route.fulfill({ response, body });
    });
    const response = await page.goto(origin + "/find");
    const policy = response.headers()["content-security-policy"];
    const nonce = policy.match(/'nonce-([^']+)'/)[1];
    const scriptPolicy = policy
      .split(";")
      .find((part) => part.trim().startsWith("script-src "));
    assert.doesNotMatch(scriptPolicy, /unsafe-inline|unsafe-eval/);
    const scripts = await page
      .locator("script:not([data-csp-test])")
      .evaluateAll((elements) => elements.map((s) => s.nonce));
    assert.ok(scripts.length > 0 && scripts.every((value) => value === nonce));
    const nextResponse = await fetch(origin + "/find", {
      headers: {
        "Content-Security-Policy": "script-src 'nonce-caller-controlled'",
      },
    });
    const nextPolicy = nextResponse.headers.get("content-security-policy");
    assert.notEqual(nextPolicy.match(/'nonce-([^']+)'/)[1], nonce);
    assert.doesNotMatch(nextPolicy, /caller-controlled/);
    assert.match(nextResponse.headers.get("cache-control"), /no-store/);
    assert.equal(
      await page.evaluate(() => window.pantryfitInjected),
      undefined,
    );
    await page.getByLabel("ZIP code").fill("10467");
    await page.getByRole("button", { name: "Cambiar a español" }).click();
    await expect(page.getByLabel("Código postal")).toHaveValue("10467");
    await page.getByRole("button", { name: "Switch to English" }).click();
    for (let step = 0; step < 5; step++) {
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    }
    await page.getByRole("button", { name: "Find My Matches" }).click();
    await expect(page).toHaveURL(/\/results$/);
    await expect(page.locator(".match-card").first()).toBeVisible();
    await page
      .getByRole("link", { name: "View details", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/providers\//);
    await expect(
      page.getByText("Directions are disabled for fictional locations."),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Back to results", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Edit preferences", exact: true })
      .click();
    await expect(page.getByLabel("ZIP code")).toHaveValue("10467");
    assert.deepEqual(errors, []);
    console.log(
      "Production CSP: fresh nonces, caller override, injection blocked, hydration and client navigation passed",
    );
  } finally {
    await browser.close();
  }
}
async function check(allowDemo) {
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        PANTRYFIT_ALLOW_DEMO: allowDemo ? "true" : "false",
        PANTRYFIT_DEMO_FILE: join(directory, "demo.json"),
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let output = "";
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Production server startup timeout")),
        30000,
      );
      const fail = (error) => {
        clearTimeout(timer);
        reject(error);
      };
      server.once("error", fail);
      server.once("exit", (code) =>
        fail(Error(`Production server exited: ${code}`)),
      );
      server.stdout.on("data", (data) => {
        output += data.toString();
        if (output.includes("Ready in")) {
          clearTimeout(timer);
          resolve();
        }
      });
      server.stderr.on("data", (data) => {
        output += data.toString();
      });
    });
    const health = await fetch(origin + "/api/health");
    assert.equal(health.status, allowDemo ? 200 : 503);
    assert.deepEqual(await health.json(), {
      status: allowDemo ? "ok" : "unavailable",
    });
    const providers = await fetch(origin + "/api/providers");
    assert.equal(providers.status, allowDemo ? 200 : 503);
    assert.match(providers.headers.get("cache-control"), /no-store/);
    assert.match(
      providers.headers.get("content-security-policy"),
      /object-src 'none'/,
    );
    assert.doesNotMatch(
      providers.headers.get("content-security-policy"),
      /unsafe-eval/,
    );
    if (allowDemo) {
      const data = await providers.json();
      assert.equal(data.demoAuth, true);
      assert.ok(
        data.providers.length > 0 && data.providers.every((p) => p.demo),
      );
      await checkBrowser();
    } else {
      const login = await fetch(origin + "/api/auth/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "provider@demo.pantryfit.test",
          password: "PantryFit-demo-2026",
        }),
      });
      assert.equal(login.status, 503);
      assert.equal(login.headers.get("set-cookie"), null);
    }
    console.log(
      `Production ${allowDemo ? "explicit fictional demo" : "unconfigured fail-closed"}: passed`,
    );
  } catch (error) {
    console.error(output.slice(-2000));
    throw error;
  } finally {
    if (server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    }
  }
}
try {
  await check(false);
  await check(true);
} finally {
  await rm(join(directory, "demo.json"), { force: true });
  await rmdir(directory);
}
