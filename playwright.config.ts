import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Each run owns its data file and server, even when a developer server is open.
process.env.PANTRYFIT_E2E_FILE = join(
  tmpdir(),
  `pantryfit-e2e-${randomUUID()}.json`,
);
export default defineConfig({
  globalTeardown: "./e2e/teardown.ts",
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://localhost:3102",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3102",
    url: "http://localhost:3102",
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
      PANTRYFIT_DEMO_FILE: process.env.PANTRYFIT_E2E_FILE,
    },
    timeout: 120000,
  },
});
