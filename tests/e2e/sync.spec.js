// Space and an open planner tab edit the same map at the same time
// (map-ops.js ops over the "mandala-sync" BroadcastChannel).
import { test, expect, seedMap, openPlanner, openSpace, focusInSpace, readMap, trackErrors, labelTexts, clickNode } from "./fixtures.js";
import { marathonMap } from "../fixtures/maps.js";

test.use({ reducedMotion: "reduce" });

test("edits made in Space reach the planner and survive its autosave", async ({ page: planner, context }) => {
  const { state, ids } = marathonMap();
  await seedMap(planner, state);
  await openPlanner(planner);

  // open the planner inspector on Gear: it must refresh when Space edits Gear
  await clickNode(planner, ids["Gear"]);
  await expect(planner.locator("#selectionTitle")).toHaveText("Gear");
  await planner.locator("#detailsButton").click();
  await expect(planner.locator("#inspector")).toHaveClass(/open/);

  const space = await context.newPage();
  const spaceErrors = trackErrors(space);
  await openSpace(space, "?map=map_test");

  // impact on Gear → planner inspector follows
  await focusInSpace(space, "Gear");
  await space.evaluate(() => { document.getElementById("panelEditor").open = true; });
  await space.locator('#impactSeg [data-value="1"]').click();
  await expect(planner.locator("#impactInput")).toHaveValue("1");

  // status + rename
  await focusInSpace(space, "Training plan");
  await focusInSpace(space, "Training plan task 2");
  await space.locator('#statusSwitch [data-status="done"]').click();
  await focusInSpace(space, "Training plan");
  await space.locator("#editTitleButton").click();
  await space.locator("#titleInput").fill("Training block");
  await space.keyboard.press("Enter");
  await expect(planner.locator(`.map-node[data-id="${ids["Training plan"]}"]`)).toContainText("Training block");

  // + Branch on a moon, Clear on a planet
  await focusInSpace(space, "Nutrition");
  await focusInSpace(space, "Nutrition task 2");
  await space.locator("#branchButton").click();
  await expect(space.locator("#panelChildrenHead")).toHaveText(/\(\+8 empty\)/);
  await focusInSpace(space, "Recovery");
  await space.locator("#clearButton").click();
  await space.locator("#clearButton").click();
  await expect(space.locator("#panelKind")).toHaveText("GOAL · SUN");

  // the planner applied every op and its own autosave keeps them
  await expect.poll(async () => {
    const map = await readMap(planner);
    const n = map.state.nodes;
    return {
      title: map.title,
      gearImpact: n[ids["Gear"]].impact,
      done: n[ids["Training plan task 2"]].status,
      renamed: n[ids["Training plan"]].title,
      slots: (n[ids["Nutrition task 2"]].children || []).length,
      cleared: n[ids["Recovery"]].title === "" && n[ids["Recovery"]].children.length === 0 && !n[ids["Foam roll"]]
    };
  }, { timeout: 10_000 }).toEqual({ title: "Run a marathon", gearImpact: 1, done: "done", renamed: "Training block", slots: 8, cleared: true });

  // let the planner's debounced save run once more and check nothing was overwritten
  await planner.waitForTimeout(800);
  const final = (await readMap(planner)).state.nodes;
  expect(final[ids["Training plan"]].title).toBe("Training block");
  expect(final[ids["Nutrition task 2"]].children).toHaveLength(8);
  expect(spaceErrors).toEqual([]);
});

test("planner saves update Space live", async ({ page: planner, context }) => {
  const { state, ids } = marathonMap();
  await seedMap(planner, state);
  await openPlanner(planner);

  const space = await context.newPage();
  const spaceErrors = trackErrors(space);
  await openSpace(space, "?map=map_test");

  // rename through the planner inspector → map-saved → Space label
  await clickNode(planner, ids["Recovery"]);
  await expect(planner.locator("#selectionTitle")).toHaveText("Recovery");
  await planner.locator("#detailsButton").click();
  await planner.locator("#detailTitle").fill("Recovery & sleep");
  await expect.poll(() => labelTexts(space)).toContain("Recovery & sleep");

  // a new branch in the planner → Space rebuilds with eight more bodies
  const before = await space.locator(".label-chip").count();
  await planner.locator("#closeInspector").click();
  await clickNode(planner, ids["Gear task 3"]);
  await expect(planner.locator("#selectionTitle")).toHaveText("Gear task 3");
  await planner.locator("#splitButton").click();
  await expect.poll(() => space.locator(".label-chip").count()).toBe(before + 8);
  expect(spaceErrors).toEqual([]);
});
