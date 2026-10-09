import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ quiet: true });

const port = 3100;
const urlUji = process.env.TEST_DATABASE_URL;

if (!urlUji) {
  throw new Error("TEST_DATABASE_URL belum diisi. Salin .env.example ke .env lalu jalankan `npm run db:up`.");
}

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    // NFR-06: alur utama juga harus berjalan di Firefox dan Safari (WebKit).
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}/masuk`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: urlUji,
      APP_SECRET: process.env.APP_SECRET ?? "x".repeat(32),
      TRUST_PROXY: "false",
    },
  },
});
