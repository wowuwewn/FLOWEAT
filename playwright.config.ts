import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const OPERATOR_KEY = "e2e-operator";
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  // Chromium plus WebKit (Safari's engine on Linux). WebKit here is NOT iOS Safari: no real touch
  // stack, no iOS viewport chrome, no camera — see docs/qa/webkit.md for what it does and does not cover.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    // laptop-demo server with a known operator key (the real default is random per start)
    command: `FLOWEAT_OPERATOR_KEY=${OPERATOR_KEY} FLOWEAT_SECRET=e2e-secret FLOWEAT_RATE_PER_CLIENT=200 npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
