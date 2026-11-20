// The 3D Space view, on the built-in demo system (no stored maps).
import { devices } from "@playwright/test";
import { test, expect, BASE, openSpace, focusInSpace, domClick, labelTexts, labelTag } from "./fixtures.js";

test.use({ reducedMotion: "reduce" });

test.describe("Space on the demo system", () => {
  test.beforeEach(async ({ page }) => {
    await openSpace(page);
  });

  test("renders the system with decisions, blockers and a next move", async ({ page }) => {
    await expect(page.locator("#mapSelect")).toHaveText("Demo system");
    await expect(page.locator(".index-chip")).toHaveCount(8);
    await expect(page.locator("#nextButton")).toHaveClass(/has-next/);
    expect(await labelTag(page, "Measurement")).toBe("Later");
    expect(await labelTag(page, "Send to 5 prospects")).toBe("Blocked");
    expect(await labelTag(page, "Fix mobile issues")).toBe("Handed off");
    expect(await labelTag(page, "Post in one relevant community")).toBe("Dropped");
  });

  test("Next, search and keyboard navigation move the focus", async ({ page }) => {
    await page.locator("#nextButton").click();
    await expect(page.locator("#panelTitle")).toHaveText("Create first project");

    await page.keyboard.press("ArrowUp");
    await expect(page.locator("#panelTitle")).toHaveText("Test the main user flow");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#panelTitle")).toHaveText("Fix mobile issues");
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("#panelTitle")).toHaveText("Fix mobile issues"); // no children
    await page.keyboard.press("Escape"); // moon → its planet
    await expect(page.locator("#panelTitle")).toHaveText("Product readiness");
    await page.keyboard.press("Escape"); // planet → overview
    await expect(page.locator("#planetPanel")).toBeHidden();

    await page.keyboard.press("/");
    await expect(page.locator("#searchInput")).toBeFocused();
    await page.keyboard.type("payment");
    await expect(page.locator(".search-result").first()).toContainText("Set up payment link");
    await page.keyboard.press("Enter");
    await expect(page.locator("#panelTitle")).toHaveText("Set up payment link");
    await expect(page.locator("#spaceSearch")).toBeHidden();
  });

  test("status switch, rename and the done ring", async ({ page }) => {
    await focusInSpace(page, "Outreach");
    await focusInSpace(page, "Track replies");
    await page.locator('#statusSwitch [data-status="doing"]').click();
    await expect(page.locator("#panelStatus")).toHaveText("Doing");
    await page.locator('#statusSwitch [data-status="done"]').click();
    await expect(page.locator("#panelStatus")).toHaveText("Cleared");
    await expect(page.locator("#spaceToast")).toContainText("Orbit cleared");

    await page.keyboard.press("e");
    await expect(page.locator("#titleInput")).toBeFocused();
    await page.locator("#titleInput").fill("Track every reply");
    await page.keyboard.press("Enter");
    await expect(page.locator("#panelTitle")).toHaveText("Track every reply");
    expect(await labelTexts(page)).toContain("Track every reply");
  });

  test("naming an empty slot creates a planet; + Branch adds eight moons", async ({ page }) => {
    await domClick(page, ".label-chip.depth-1.empty");
    await expect(page.locator("#titleEdit")).toBeVisible();
    await expect(page.locator("#titleSave")).toHaveText("Create");
    await page.locator("#titleInput").fill("Hiring");
    await page.keyboard.press("Enter");
    await expect(page.locator(".index-chip", { hasText: "Hiring" })).toHaveCount(1);
    await expect(page.locator("#panelTitle")).toHaveText("Hiring");

    await page.locator("#branchButton").click();
    await expect(page.locator("#panelChildrenHead")).toHaveText(/Moons · 0\s+\(\+8 empty\)/);
    await expect(page.locator("#branchButton")).toBeHidden();
  });

  test("decisions, blockers and notes from Edit details", async ({ page }) => {
    const before = await page.locator("#nextButton").getAttribute("title");
    await focusInSpace(page, "Product readiness");
    await page.evaluate(() => { document.getElementById("panelEditor").open = true; });
    await page.locator('#decisionSeg [data-value="delete"]').click();
    expect(await labelTag(page, "Product readiness")).toBe("Dropped");
    await expect(page.locator("#nextButton")).not.toHaveAttribute("title", before);
    await page.locator('#decisionSeg [data-value="do"]').click();
    await expect(page.locator("#nextButton")).toHaveAttribute("title", before);

    await focusInSpace(page, "Launch content");
    await focusInSpace(page, "Publish one demo");
    const blockerId = await page.locator("#dependencySelect option", { hasText: "moon: Run one real payment test" }).getAttribute("value");
    await page.locator("#dependencySelect").selectOption(blockerId);
    expect(await labelTag(page, "Publish one demo")).toBe("Blocked");
    await expect(page.locator("#panelMeta")).toContainText("Blocked by");

    await page.locator("#impactSeg [data-value=\"1\"]").click();
    await expect(page.locator("#panelMeta")).toContainText("1/5");
    await page.locator("#notesInput").fill("after the payment test");
    await expect(page.locator("#panelNotes")).toHaveText("after the payment test");
  });

  test("Clear node needs two presses and returns to the parent", async ({ page }) => {
    await focusInSpace(page, "Product readiness");
    await focusInSpace(page, "Test the main user flow");
    await page.locator("#clearButton").click();
    await expect(page.locator("#clearButton")).toHaveText("Tap again to clear");
    await page.locator("#clearButton").click();
    await expect(page.locator("#panelTitle")).toHaveText("Product readiness");
    expect(await labelTexts(page)).not.toContain("Create first project");
  });

  test("grabbing the camera during a flight is safe", async ({ page }) => {
    await domClick(page, ".index-chip", "Outreach");
    await page.mouse.move(650, 450);
    await page.mouse.down();
    await page.mouse.move(760, 480, { steps: 6 });
    await page.mouse.up();
    await page.mouse.wheel(0, -300);
    await expect(page.locator("#panelTitle")).toHaveText("Outreach");
  });
});

test("full motion: intro, flights and the chromatic pass run without errors", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "no-preference", viewport: { width: 1300, height: 800 } });
  const { routeToDisk, trackErrors } = await import("./fixtures.js");
  await routeToDisk(context);
  const page = await context.newPage();
  const errors = trackErrors(page);
  await openSpace(page);
  await page.locator("#nextButton").click();
  await expect(page.locator("#panelTitle")).toHaveText("Create first project");
  expect(errors).toEqual([]);
  await context.close();
});

test("without import maps Space shows its fallback instead of hanging", async ({ page }) => {
  await page.addInitScript(() => { HTMLScriptElement.supports = () => false; });
  await page.goto(BASE + "/space.html");
  await expect(page.locator("#spaceFallback")).toBeVisible();
  await expect(page.locator("#spaceFallback h1")).toHaveText("Space needs a newer browser");
  await expect(page.locator("#spaceLoader")).toBeHidden();
});

// iPhone-sized viewport and touch, on Chromium (the device preset alone would ask for WebKit)
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];

test.describe("on a phone", () => {
  test.use({ ...iPhone, deviceScaleFactor: 1, reducedMotion: "reduce" });

  test("panel opens as a bottom sheet and Next works", async ({ page }) => {
    await openSpace(page);
    await page.locator("#nextButton").click();
    await expect(page.locator("#panelTitle")).toHaveText("Create first project");
    // the sheet slides up; measure once the animation has settled
    const viewport = page.viewportSize();
    await expect.poll(async () => {
      const panel = await page.locator("#planetPanel").boundingBox();
      return [Math.round(panel.y + panel.height), Math.round(panel.width)];
    }).toEqual([viewport.height, viewport.width]);
  });
});
