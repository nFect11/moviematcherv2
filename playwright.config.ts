import { defineConfig, devices } from "@playwright/test";

const runMultiUserSimulator = process.env.RUN_MULTI_USER_SIM === "1";
const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: {
    command: runMultiUserSimulator
      ? 'npx --yes netlify dev -p 4173 --command "npm run dev --workspace apps/web -- --host 127.0.0.1 --port 4174"'
      : "npm run dev --workspace apps/web -- --host 127.0.0.1 --port 4173",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: runMultiUserSimulator ? 300_000 : 120_000
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
