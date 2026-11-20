// The 2D planner: first run, editing, views, backup/restore, deep links.
import fs from "node:fs";
import { test, expect, BASE, seedMap, openPlanner, readMap, listMaps, clickNode } from "./fixtures.js";
import { marathonMap } from "../fixtures/maps.js";

const nodeById = (page, id) => page.locator(`.map-node[data-id="${id}"]`);

test("first run: a goal grows eight driver slots", async ({ page }) => {
  await page.goto(BASE + "/index.html");
  await expect(page.locator("body")).toHaveClass(/empty-start/);
  // the starter only reacts once the planner has finished booting
  await expect(async () => {
    await page.evaluate(() => document.getElementById("rootStarter").click());
    await expect(page.locator("#rootInput")).toBeVisible({ timeout: 500 });
  }).toPass();
  await page.locator("#rootInput").fill("Write a book");
  await page.keyboard.press("Enter");
  await expect(page.locator(".map-node")).toHaveCount(9);
  await expect(page.locator(".map-node").first()).toContainText("Write a book");
  await expect.poll(async () => (await listMaps(page)).map((m) => m.title)).toEqual(["Write a book"]);
});

test("typing a goal while storage is still loading is not interrupted", async ({ page }) => {
  // make MandalaStorage.init() take 1.5 s, as on a slow phone
  await page.addInitScript(() => {
    Object.defineProperty(window, "MandalaStorage", {
      configurable: true,
      set(storage) {
        const init = storage.init;
        storage.init = () => new Promise((resolve) => setTimeout(resolve, 1500)).then(() => init());
        Object.defineProperty(window, "MandalaStorage", { value: storage, writable: true, configurable: true });
      }
    });
  });
  await page.goto(BASE + "/index.html");
  await expect(async () => {
    await page.evaluate(() => document.getElementById("rootStarter").click());
    await expect(page.locator("#rootInput")).toBeVisible({ timeout: 200 });
  }).toPass();
  await page.locator("#rootInput").pressSequentially("Learn to sail");
  await page.waitForTimeout(1800); // storage finishes loading meanwhile
  await expect(page.locator("#rootInput")).toBeVisible();
  await expect(page.locator("#rootInput")).toHaveValue("Learn to sail");
  await page.keyboard.press("Enter");
  await expect(page.locator(".map-node")).toHaveCount(9);
});

test("name a slot, branch it, then clear it", async ({ page }) => {
  const { state, ids } = marathonMap();
  await seedMap(page, state);
  await openPlanner(page);
  const empty = Object.values(state.nodes).find((n) => n.depth === 1 && !n.title).id;

  await clickNode(page, empty, { double: true });
  await page.locator(".node-edit").fill("Mindset");
  await page.keyboard.press("Enter");
  await expect(nodeById(page, empty)).toContainText("Mindset");

  const before = await page.locator(".map-node").count();
  await clickNode(page, empty);
  await expect(page.locator("#selectionTitle")).toHaveText("Mindset");
  await page.locator("#splitButton").click();
  await expect(page.locator(".map-node")).toHaveCount(before + 8);

  await page.locator("#detailsButton").click();
  await page.locator("#deleteNodeButton").click();
  await expect(page.locator(".map-node")).toHaveCount(before);
  await expect.poll(async () => (await readMap(page)).state.nodes[empty].title).toBe("");
  expect(ids["Training plan"]).toBeTruthy();
});

test("Map, Table and Grid show the same nodes; Grid is desktop-only", async ({ page }) => {
  const { state } = marathonMap();
  await seedMap(page, state);
  await openPlanner(page);

  await page.locator("#tableViewButton").click();
  await expect(page.locator("#tableView")).toBeVisible();
  const tableTitles = await page.locator("#nodeTableBody .table-title-input").evaluateAll((inputs) => inputs.map((i) => i.value));
  expect(tableTitles).toEqual(expect.arrayContaining(["Run a marathon", "Nutrition", "Nutrition task 2", "Foam roll"]));

  await page.locator("#gridViewButton").click();
  await expect(page.locator("#gridView")).toBeVisible();
  await expect(page.locator("#mandalaGrid .mandala-grid-cell")).toHaveCount(81);
  await expect(page.locator("#mandalaGrid")).toContainText("Recovery");

  await page.setViewportSize({ width: 900, height: 800 });
  await expect(page.locator("#gridView")).toBeHidden();
  await expect(page.locator("#gridViewButton")).toBeHidden();
});

test("Save then Import restores the map as a new map", async ({ page }, testInfo) => {
  const { state, ids } = marathonMap();
  state.nodes[ids["Nutrition task 2"]].notes = "two eggs";
  state.nodes[ids["Gear task 2"]].dependencyId = ids["Nutrition task 2"];
  await seedMap(page, state, { id: "m1" });
  await openPlanner(page);

  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#exportButton").click()]);
  const file = testInfo.outputPath("export.json");
  await download.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(exported.rootId).toBe(state.rootId);
  expect(Object.keys(exported.nodes)).toHaveLength(Object.keys(state.nodes).length);

  await page.evaluate(async () => window.MandalaStorage.deleteMap("m1"));
  await page.reload();
  await page.locator("#mapsButton").click();
  await expect(page.locator("#mapsModal")).toBeVisible();
  await expect(page.locator(".maps-storage-note")).toContainText("stored only in this browser");
  await page.setInputFiles("#importMapInput", file);
  await expect(page.locator("#toast")).toContainText("Imported “Run a marathon” as a new map.");

  const maps = await listMaps(page);
  expect(maps).toHaveLength(1);
  const imported = maps[0].state;
  expect(Object.keys(imported.nodes)).toHaveLength(Object.keys(state.nodes).length);
  expect(imported.nodes[ids["Nutrition task 2"]].notes).toBe("two eggs");
  expect(imported.nodes[ids["Gear task 2"]].dependencyId).toBe(ids["Nutrition task 2"]);
  expect(imported.nodes[ids["Gear"]].decision).toBe("defer");
  await expect(page.locator(".map-node").first()).toBeVisible();
});

test("broken or hostile import files are rejected or cleaned, never destructive", async ({ page }, testInfo) => {
  const { state } = marathonMap();
  await seedMap(page, state, { id: "keep" });
  await openPlanner(page);

  const cases = [
    ["not-json.json", "{oops", "This file is not valid JSON."],
    ["wrong.json", JSON.stringify({ hello: 1 }), "This file is not a Mandala map."],
    ["orphans.json", JSON.stringify({
      rootId: "r",
      nodes: {
        r: { id: "r", title: "Root", children: ["x", "missing"] },
        x: { id: "x", title: "<img src=x onerror=alert(1)>", children: [], status: "weird", impact: 99, dependencyId: "x" },
        lost: { id: "lost", title: "Orphan", children: [] }
      }
    }), "Imported “Root” as a new map."]
  ];

  // the Maps dialog opens asynchronously; a failed import leaves it open
  await page.locator("#mapsButton").click();
  await expect(page.locator("#mapsModal")).toBeVisible();

  for (const [name, body, message] of cases) {
    const file = testInfo.outputPath(name);
    fs.writeFileSync(file, body);
    await page.setInputFiles("#importMapInput", file);
    await expect(page.locator("#toast")).toContainText(message);
  }

  const maps = await listMaps(page);
  expect(maps.map((m) => m.id)).toContain("keep");
  const cleaned = maps.find((m) => m.state.nodes.r).state;
  expect(Object.keys(cleaned.nodes).sort()).toEqual(["r", "x"]);
  expect(cleaned.nodes.r.children).toEqual(["x"]);
  expect(cleaned.nodes.x).toMatchObject({ status: "open", impact: 3, dependencyId: null, parentId: "r", depth: 1 });
  await expect(page.locator(".map-node img")).toHaveCount(0);
  await expect(page.locator(".map-node", { hasText: "<img src=x onerror=alert(1)>" })).toHaveCount(1);
});

test("deep links: index.html?node= selects the node, Space ✦ carries it over", async ({ page }) => {
  const { state, ids } = marathonMap();
  await seedMap(page, state);
  await openPlanner(page, `?node=${ids["Recovery task 2"]}`);
  await expect(page.locator("#selectionTitle")).toHaveText("Recovery task 2");
  expect(new URL(page.url()).search).toBe("");

  const navigation = page.waitForRequest((request) => request.isNavigationRequest() && request.url().includes("space.html"));
  await page.locator("#spaceViewButton").click();
  const url = new URL((await navigation).url());
  expect(url.searchParams.get("map")).toBe("map_test");
  expect(url.searchParams.get("node")).toBe(ids["Recovery task 2"]);
});
