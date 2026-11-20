// Tests run without a web server: tests/e2e/fixtures.js answers every request
// to http://mandala.test/ straight from the files in this folder.
import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  projects: [
    {
      name: "unit",
      testDir: "tests/unit"
    },
    {
      name: "e2e",
      testDir: "tests/e2e",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1300, height: 800 },
        trace: "off",
        launchOptions: {
          // software WebGL so the Space scene renders on machines without a GPU
          args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
        }
      }
    }
  ]
});
