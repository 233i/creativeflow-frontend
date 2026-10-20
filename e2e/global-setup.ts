import type { FullConfig } from "@playwright/test";
import { verifyBrowserEnvironment } from "../scripts/browser-environment.mjs";

export default async function setup(config: FullConfig) {
  await verifyBrowserEnvironment({
    baseURL: config.projects[0].use.baseURL,
    apiOrigin: process.env.SOL_API_ORIGIN ?? "http://localhost:5298",
    environment: process.env.SOL_E2E_EXPECTED_ENVIRONMENT ?? "Development",
  });
}
