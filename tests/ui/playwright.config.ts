import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "candidate-console.spec.ts", workers: 1, timeout: 90_000, expect: { timeout: 15_000 },
  outputDir: "../../.cache/ui-tests", reporter: "list",
  use: { baseURL: "http://127.0.0.1:4321", actionTimeout: 15_000, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: 'node --import tsx tests/ui/start-offline-console.ts', cwd: "../..", url: "http://127.0.0.1:4321/api/session", reuseExistingServer: false, timeout: 30_000, gracefulShutdown: { signal: "SIGTERM", timeout: 5000 } },
});
