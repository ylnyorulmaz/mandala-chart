// The planner (app.js) and Space (space/model.js) implement progress and
// next-move rules separately. These tests make sure they never disagree.
import { test, expect, seedMap, openPlanner, openSpace, domClick } from "./fixtures.js";
import * as model from "../../space/model.js";
import { randomMap } from "../fixtures/maps.js";

// 2, 16 and 26 are picked so that changing any term of scoreNode changes the winner
const SEEDS = [2, 3, 11, 16, 26, 27, 42, 77, 131];

test.use({ reducedMotion: "reduce" });

for (const seed of SEEDS) {
  test(`progress and next move agree — random map #${seed}`, async ({ page }) => {
    const { state } = randomMap(seed);
    const root = state.nodes[state.rootId];
    const stats = model.leafStats(state, root);
    const expectedPercent = stats.total ? Math.round((stats.done / stats.total) * 100) + "%" : null;
    const expectedNext = model.nextActionNode(state);

    await seedMap(page, state);

    // planner
    await openPlanner(page);
    const questVisible = await page.locator("#questProgress").isVisible();
    if (expectedPercent) {
      expect(questVisible, "planner shows quest progress").toBe(true);
      await expect(page.locator("#questProgressValue")).toHaveText(expectedPercent);
    } else {
      expect(questVisible, "planner hides quest progress").toBe(false);
    }

    await page.locator("#nextButton").click();
    await expect(page.locator("#nextModal")).toBeVisible();
    const plannerNext = (await page.locator("#nextActionTitle").textContent()).trim();
    expect(plannerNext).toBe(expectedNext ? expectedNext.title : "No ready action yet.");

    // Space
    await openSpace(page, "?map=map_test");
    await domClick(page, ".index-chip.sun");
    await expect(page.locator("#panelKind")).toHaveText("GOAL · SUN");
    if (expectedPercent) {
      await expect(page.locator("#panelProgressValue")).toHaveText(`${expectedPercent}  ·  ${stats.done}/${stats.total}`);
    } else {
      await expect(page.locator("#panelProgress")).toBeHidden();
    }
    const spaceNextTitle = await page.locator("#nextButton").getAttribute("title");
    expect(spaceNextTitle).toBe(expectedNext ? `Next move: ${expectedNext.title} (N)` : "No ready action yet (N)");
  });
}
