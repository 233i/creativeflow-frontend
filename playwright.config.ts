import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.SOL_E2E_BASE_URL ?? "http://localhost:3000";
const origin = new URL(baseURL);
const server = process.env.SOL_E2E_SERVER ?? (process.env.CI ? "production" : "dev");
if (!["dev", "production", "external"].includes(server))
  throw new Error("SOL_E2E_SERVER must be dev, production, or external.");
if (server !== "external" && !["localhost", "127.0.0.1"].includes(origin.hostname))
  throw new Error("An owned test server must bind to localhost or 127.0.0.1.");
const port = origin.port || (origin.protocol === "https:" ? "443" : "80");

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "output/playwright/e2e/results",
  // 跨服务测试共享 API、数据库和设备指纹限流，串行执行。
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  failOnFlakyTests: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/playwright/e2e/report", open: "never" }],
    ["json", { outputFile: "output/playwright/e2e/results.json" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    channel: process.env.SOL_E2E_CHANNEL,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer:
    server === "external"
      ? undefined
      : {
          // production 使用已完成 verify 的产物；构建时也要提供 SOL_API_ORIGIN。
          command: `npm run ${server === "production" ? "start" : "dev"} -- --hostname ${origin.hostname} --port ${port}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI && server === "dev",
          timeout: 120_000,
        },
});
