import { defineConfig, devices } from "@playwright/test";
import { browserEnvironment } from "./tests/local-environment";
const environment = browserEnvironment(process.env);
Object.assign(process.env, environment);
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  // Auth cookies, email links and upload capabilities must not enter artefacts.
  use: { baseURL: environment.APP_ORIGIN, trace: "off", screenshot: "off", video: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    env: environment,
  },
});
