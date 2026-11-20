// The view switcher (Map / Table / Grid / Space) must never cover the planner
// actions or the zoom toolbar — it used to hide Ideas / Inspect / + Branch.
import { test, expect, seedMap, openPlanner } from "./fixtures.js";
import { marathonMap } from "../fixtures/maps.js";

const WIDTHS = [1600, 1300, 1240, 1239, 1100, 900, 761, 390];

const overlaps = (a, b) => a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

// Devices have different fonts: run every width once more with noticeably wider
// button text, so the layout does not depend on one machine's font metrics.
const WIDE_FONTS = ".soft-button, .view-button, .map-tool { letter-spacing: .06em !important; font-size: 12px !important; }";

for (const width of WIDTHS) for (const wideFonts of [false, true]) {
  test(`top controls do not overlap at ${width}px${wideFonts ? " (wide fonts)" : ""}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const { state } = marathonMap();
    await seedMap(page, state);
    await openPlanner(page);
    if (wideFonts) await page.addStyleTag({ content: WIDE_FONTS });

    const switcher = await page.locator("#viewSwitcher").boundingBox();
    const actions = await page.locator("#plannerActions").boundingBox();
    const toolbar = await page.locator(".map-toolbar").boundingBox();

    expect(switcher, "view switcher is visible").toBeTruthy();
    expect(overlaps(switcher, actions), "switcher vs planner actions").toBeFalsy();
    expect(overlaps(switcher, toolbar), "switcher vs zoom toolbar").toBeFalsy();
    if (width > 760) expect(overlaps(actions, toolbar), "planner actions vs zoom toolbar").toBeFalsy();

    // every planner action must be reachable (not hidden under another control)
    for (const id of ["suggestButton", "detailsButton", "splitButton", "nextButton", "exportButton"]) {
      const button = page.locator("#" + id);
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.id || null, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      expect(hit, `#${id} is not covered`).toBe(id);
    }
  });
}
