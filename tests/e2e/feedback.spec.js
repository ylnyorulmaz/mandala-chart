// Beta feedback links and the "Report it" error notice.
import fs from "node:fs";
import path from "node:path";
import { test, expect, BASE, ROOT, seedMap, openPlanner } from "./fixtures.js";
import { marathonMap } from "../fixtures/maps.js";

const CACHE_NAME = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8").match(/CACHE_NAME = "([^"]+)"/)[1];

for (const pageName of ["index.html", "about.html", "blog.html", "space.html"]) {
  test(`${pageName} has a Feedback link`, async ({ page }) => {
    await page.goto(BASE + "/" + pageName);
    const link = page.locator("[data-feedback]");
    await expect(link).toHaveCount(1);
    if (pageName !== "space.html") await expect(page.locator(".beta-chip")).toBeVisible();
  });
}

test("Feedback opens the issue form with the environment and never map contents", async ({ page }) => {
  const { state } = marathonMap();
  await seedMap(page, state);
  await openPlanner(page);
  const href = await page.evaluate(() => {
    const link = document.querySelector("[data-feedback]");
    link.dispatchEvent(new Event("pointerdown"));
    return link.href;
  });
  const url = new URL(href);
  expect(url.origin + url.pathname).toBe("https://github.com/ylnyorulmaz/mandala-chart/issues/new");
  expect(url.searchParams.get("template")).toBe("feedback.yml");
  const environment = url.searchParams.get("environment");
  expect(environment).toContain("Version: " + CACHE_NAME);
  expect(environment).toContain("Page: /index.html");
  expect(decodeURIComponent(href)).not.toContain("marathon");
  expect(decodeURIComponent(href)).not.toContain("Nutrition");
});

test("an uncaught error shows one Report it notice with the error attached", async ({ page }) => {
  page.allowErrors();
  await page.goto(BASE + "/about.html");
  await page.evaluate(() => {
    setTimeout(() => { throw new Error("beta boom"); }, 0);
    setTimeout(() => { throw new Error("second"); }, 10);
  });
  await expect(page.locator(".mandala-report")).toHaveCount(1);
  const reportUrl = new URL(await page.locator(".mandala-report a").getAttribute("href"));
  expect(reportUrl.searchParams.get("template")).toBe("bug.yml");
  expect(reportUrl.searchParams.get("error")).toMatch(/^beta boom/);
  await page.locator(".mandala-report button").click();
  await expect(page.locator(".mandala-report")).toHaveCount(0);
});
