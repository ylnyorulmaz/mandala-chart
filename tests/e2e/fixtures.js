// Shared Playwright fixtures for the end-to-end tests.
//
// No web server is started: every request to http://mandala.test/ is answered
// from the files in this repository (context.route). That keeps tests
// independent of ports and processes, and identical locally and in CI.
import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const BASE = "http://mandala.test";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg"
};

// noise from software WebGL, not from the app
const IGNORED_CONSOLE = /GPU stall|GL Driver|swiftshader|WebGL/i;

export async function routeToDisk(context) {
  await context.route(BASE + "/**", (route) => {
    const url = new URL(route.request().url());
    const file = path.join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: "Not found" });
    }
    return route.fulfill({
      status: 200,
      contentType: TYPES[path.extname(file)] || "application/octet-stream",
      body: fs.readFileSync(file)
    });
  });
}

/** Collect console errors and uncaught exceptions of a page. */
export function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !IGNORED_CONSOLE.test(message.text())) errors.push("console: " + message.text());
  });
  return errors;
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await routeToDisk(context);
    await use(context);
  },

  /** Every test fails if its main page logs an error, unless it calls allowErrors(). */
  page: async ({ page }, use, testInfo) => {
    const errors = trackErrors(page);
    page.allowErrors = () => { errors.allowed = true; };
    await use(page);
    if (!errors.allowed && testInfo.status === testInfo.expectedStatus) {
      expect(errors, "console errors / uncaught exceptions").toEqual([]);
    }
  }
});

export { expect };

/** Store a map in IndexedDB through the app's own MandalaStorage and make it active. */
export async function seedMap(page, state, { id = "map_test", title } = {}) {
  await page.goto(BASE + "/about.html");
  await page.addScriptTag({ url: BASE + "/vendor/idb-6.1.5.min.js" });
  await page.addScriptTag({ url: BASE + "/storage.js" });
  await page.evaluate(async ({ state, id, title }) => {
    await window.MandalaStorage.init();
    const now = Date.now();
    await window.MandalaStorage.saveMap({ id, title, createdAt: now, updatedAt: now, group: "", state });
    await window.MandalaStorage.setActiveMapId(id);
  }, { state, id, title: title || state.nodes[state.rootId].title });
  return id;
}

/** Read a stored map (the page must have storage.js loaded: planner or Space). */
export async function readMap(page, id = "map_test") {
  return page.evaluate(async (mapId) => {
    await window.MandalaStorage.init();
    return window.MandalaStorage.getMap(mapId);
  }, id);
}

export async function listMaps(page) {
  return page.evaluate(async () => {
    await window.MandalaStorage.init();
    return window.MandalaStorage.listMaps();
  });
}

/** Open the planner on the active map. */
export async function openPlanner(page, query = "") {
  await page.goto(BASE + "/index.html" + query);
  if (!query) {
    await page.locator("#continueButton").click();
  }
  await expect(page.locator(".map-node").first()).toBeVisible();
}

/** Open Space and wait for the intro loader to go away. */
export async function openSpace(page, query = "") {
  await page.goto(BASE + "/space.html" + query);
  await expect(page.locator("#spaceLoader")).toBeHidden({ timeout: 30_000 });
  await expect(page.locator("#spaceFallback")).toBeHidden();
}

/** Click a DOM element by evaluating .click() — for moving labels and animated controls. */
export async function domClick(page, selector, text) {
  await page.evaluate(({ selector, text }) => {
    const items = Array.from(document.querySelectorAll(selector));
    const match = text === undefined
      ? items[0]
      : items.find((el) => (el.querySelector("span") || el).textContent.replace("✦", "").trim() === text);
    if (!match) throw new Error(`No ${selector} with text "${text}"`);
    match.click();
  }, { selector, text });
}

/**
 * Planner: select (or double-click) a map node by id. Dispatches the DOM event
 * directly, so it works even when the node is outside the visible canvas.
 */
export async function clickNode(page, id, { double = false } = {}) {
  await page.evaluate(({ id, double }) => {
    const node = document.querySelector(`.map-node[data-id="${id}"]`);
    if (!node) throw new Error("No map node " + id);
    node.dispatchEvent(new MouseEvent(double ? "dblclick" : "click", { bubbles: true, cancelable: true }));
  }, { id, double });
}

/** Space: focus a body through the left index (planets) or the panel list (moons). */
export async function focusInSpace(page, title) {
  const inIndex = await page.locator(".index-chip span", { hasText: new RegExp(`^${escapeRegExp(title)}$`) }).count();
  if (inIndex) await domClick(page, ".index-chip", title);
  else await domClick(page, ".moon-chip", title);
  await expect(page.locator("#panelTitle")).toHaveText(title);
}

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function labelTexts(page) {
  return page.locator(".label-chip span").allTextContents();
}

export async function labelTag(page, title) {
  return page.evaluate((t) => {
    const chip = Array.from(document.querySelectorAll(".label-chip")).find((c) => c.querySelector("span").textContent === t);
    return chip ? chip.querySelector("em").textContent : null;
  }, title);
}
