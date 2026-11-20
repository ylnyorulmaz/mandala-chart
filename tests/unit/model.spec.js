// Unit tests for space/model.js — the rules Space shares with the planner.
import { test, expect } from "@playwright/test";
import * as model from "../../space/model.js";
import { buildMap } from "../fixtures/maps.js";

function sample() {
  return buildMap({
    title: "Goal",
    children: [
      {
        title: "Do driver",
        children: [
          { title: "Ready", impact: 5, effort: 1 },
          { title: "Doing", status: "doing", impact: 3, effort: 3 },
          { title: "Done", status: "done" },
          { title: "Blocked", impact: 5, effort: 1, blockedBy: "Doing" },
          { title: "Dropped", decision: "delete", impact: 5, effort: 1 },
          { title: "Split", children: [{ title: "Step one", impact: 4, effort: 2, duration: "15" }, { title: "" }] },
          { title: "" }
        ]
      },
      { title: "Parked driver", decision: "defer", children: [{ title: "Hidden by parent", impact: 5, effort: 1 }] },
      { title: "", children: [{ title: "Under emptied driver", impact: 1, effort: 5 }] }
    ]
  });
}

test.describe("space/model.js", () => {
  test("nodeTitle trims and tolerates missing titles", () => {
    expect(model.nodeTitle({ title: "  hi  " })).toBe("hi");
    expect(model.nodeTitle({ title: "   " })).toBe("");
    expect(model.nodeTitle({})).toBe("");
    expect(model.nodeTitle(null)).toBe("");
  });

  test("decisionValue falls back to do", () => {
    expect(model.decisionValue({ decision: "defer" })).toBe("defer");
    expect(model.decisionValue({ decision: "nonsense" })).toBe("do");
    expect(model.decisionValue({})).toBe("do");
  });

  test("hasSuppressedAncestor looks at drivers and below, not the goal", () => {
    const { state, ids } = sample();
    expect(model.hasSuppressedAncestor(state, state.nodes[ids["Hidden by parent"]])).toBe(true);
    expect(model.hasSuppressedAncestor(state, state.nodes[ids["Ready"]])).toBe(false);
    state.nodes[state.rootId].decision = "delete";
    expect(model.hasSuppressedAncestor(state, state.nodes[ids["Ready"]])).toBe(false);
  });

  test("isNodeBlocked resolves when the blocker is done or dropped", () => {
    const { state, ids } = sample();
    const blocked = state.nodes[ids["Blocked"]];
    expect(model.isNodeBlocked(state, blocked)).toBe(true);
    state.nodes[ids["Doing"]].status = "done";
    expect(model.isNodeBlocked(state, blocked)).toBe(false);
    state.nodes[ids["Doing"]].status = "open";
    state.nodes[ids["Doing"]].decision = "delete";
    expect(model.isNodeBlocked(state, blocked)).toBe(false);
    blocked.dependencyId = "missing";
    expect(model.isNodeBlocked(state, blocked)).toBe(false);
  });

  test("suppressionOf: own decision first, then parked ancestors", () => {
    const { state, ids } = sample();
    expect(model.suppressionOf(state, state.nodes[ids["Dropped"]])).toBe("drop");
    expect(model.suppressionOf(state, state.nodes[ids["Parked driver"]])).toBe("later");
    expect(model.suppressionOf(state, state.nodes[ids["Hidden by parent"]])).toBe("inherited");
    state.nodes[ids["Ready"]].decision = "delegate";
    expect(model.suppressionOf(state, state.nodes[ids["Ready"]])).toBe("handoff");
    expect(model.suppressionOf(state, state.nodes[ids["Doing"]])).toBe(null);
  });

  test("leafStats counts actionable Do leaves only — like the planner's quest progress", () => {
    const { state, ids } = sample();
    // Ready, Doing, Done, Blocked, Step one, Under emptied driver
    // (Dropped is not Do, Split has a filled child, Hidden by parent is parked)
    expect(model.leafStats(state, state.nodes[state.rootId])).toEqual({ total: 6, done: 1 });
    expect(model.leafStats(state, state.nodes[ids["Do driver"]])).toEqual({ total: 5, done: 1 });
    expect(model.leafStats(state, state.nodes[ids["Ready"]])).toEqual({ total: 0, done: 0 });
  });

  test("scoreNode matches the planner formula", () => {
    expect(model.scoreNode({ impact: 5, effort: 1 })).toBe(9);
    expect(model.scoreNode({ impact: 3, effort: 3, status: "doing" })).toBe(5);
    expect(model.scoreNode({ impact: 3, effort: 3, duration: "30" })).toBe(4);
    expect(model.scoreNode({ impact: 3, effort: 3, duration: "31" })).toBe(3);
    expect(model.scoreNode({})).toBe(3);
  });

  test("nextActionNode picks the best ready Do leaf", () => {
    const { state, ids } = sample();
    // Ready scores 9; Blocked, Dropped and Hidden would also score 9 but are excluded
    expect(model.nextActionNode(state).id).toBe(ids["Ready"]);
    state.nodes[ids["Ready"]].status = "done";
    // Step one: 4*2-2+1 = 7 beats Doing: 3*2-3+2 = 5
    expect(model.nextActionNode(state).id).toBe(ids["Step one"]);
    for (const node of Object.values(state.nodes)) if (node.depth >= 2) node.status = "done";
    expect(model.nextActionNode(state)).toBe(null);
  });

  test("structureSignature changes only when bodies would change", () => {
    const { state, ids } = sample();
    const before = model.structureSignature(state);
    state.nodes[ids["Ready"]].status = "done";
    state.nodes[ids["Ready"]].title = "Ready (renamed)";
    state.nodes[ids["Ready"]].impact = 1;
    expect(model.structureSignature(state)).toBe(before);
    state.nodes[ids["Ready"]].title = "";
    expect(model.structureSignature(state)).not.toBe(before);
  });

  test("demoState is a valid tree with a next move", () => {
    const state = model.demoState();
    expect(state.nodes[state.rootId]).toBeTruthy();
    for (const node of Object.values(state.nodes)) {
      for (const child of node.children) expect(state.nodes[child].parentId).toBe(node.id);
    }
    expect(model.nextActionNode(state)).not.toBe(null);
  });
});
