// Unit tests for map-ops.js — the edit operations shared by Space and the planner.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildMap } from "../fixtures/maps.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadOps() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "map-ops.js"), "utf8"), sandbox);
  return sandbox.window.MandalaOps;
}

const Ops = loadOps();
const plain = (value) => JSON.parse(JSON.stringify(value));

function sample() {
  return buildMap({
    title: "Goal",
    children: [
      { title: "Driver", children: [{ title: "Action", children: [{ title: "Step" }] }, { title: "Other" }] },
      { title: "Second" }
    ]
  });
}

test.describe("map-ops.js", () => {
  test("newId has the planner's id format and is unique", () => {
    const ids = new Set(Array.from({ length: 200 }, () => Ops.newId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^n_[0-9a-z]+_[0-9a-z]{1,6}$/);
  });

  test("blankNode has every field createNode() writes", () => {
    const node = plain(Ops.blankNode("x", "p", 2));
    expect(Object.keys(node).sort()).toEqual([
      "children", "collapsed", "createdAt", "decision", "deferUntil", "delegatedTo", "dependencyId", "depth",
      "duration", "effort", "id", "impact", "notes", "offsetX", "offsetY", "parentId", "status", "tableCollapsed", "title"
    ]);
    expect(node).toMatchObject({ id: "x", parentId: "p", depth: 2, title: "", status: "open", decision: "do", impact: 3, effort: 3 });
  });

  test("update writes valid fields and ignores invalid ones", () => {
    const { state, ids } = sample();
    const id = ids["Action"];
    expect(Ops.apply(state, { op: "update", id, fields: { title: "Renamed", status: "doing", impact: 5, effort: "2", decision: "defer", deferUntil: "2026-12-01", duration: "45", notes: "n", delegatedTo: "Ana" } })).toBe(true);
    expect(state.nodes[id]).toMatchObject({ title: "Renamed", status: "doing", impact: 5, effort: 2, decision: "defer", deferUntil: "2026-12-01", duration: "45", notes: "n", delegatedTo: "Ana" });

    const before = plain(state.nodes[id]);
    expect(Ops.apply(state, { op: "update", id, fields: { impact: 9, effort: 0, status: "finished", decision: "maybe", deferUntil: "tomorrow", duration: "5000", children: [], depth: 7 } })).toBe(false);
    expect(plain(state.nodes[id])).toEqual(before);
  });

  test("update caps text lengths like the planner inputs", () => {
    const { state, ids } = sample();
    Ops.apply(state, { op: "update", id: ids["Other"], fields: { title: "x".repeat(500), notes: "y".repeat(5000), delegatedTo: "z".repeat(500) } });
    expect(state.nodes[ids["Other"]].title.length).toBe(180);
    expect(state.nodes[ids["Other"]].notes.length).toBe(1200);
    expect(state.nodes[ids["Other"]].delegatedTo.length).toBe(120);
  });

  test("blocked-by accepts candidates only: titled, not itself, not a descendant", () => {
    const { state, ids } = sample();
    const driver = ids["Driver"];
    const candidates = Ops.dependencyCandidates(state, state.nodes[driver]).map((n) => n.title).sort();
    expect(candidates).toEqual(["Goal", "Second"]);
    expect(Ops.apply(state, { op: "update", id: driver, fields: { dependencyId: ids["Step"] } })).toBe(false);
    expect(Ops.apply(state, { op: "update", id: driver, fields: { dependencyId: driver } })).toBe(false);
    expect(Ops.apply(state, { op: "update", id: driver, fields: { dependencyId: ids["Second"] } })).toBe(true);
    expect(Ops.apply(state, { op: "update", id: driver, fields: { dependencyId: null } })).toBe(true);
    expect(state.nodes[driver].dependencyId).toBe(null);
  });

  test("addSlots adds eight empty children with the sender's ids", () => {
    const { state, ids } = sample();
    const newIds = Array.from({ length: 8 }, (_, i) => "slot" + i);
    expect(Ops.apply(state, { op: "addSlots", parentId: ids["Other"], ids: newIds })).toBe(true);
    expect(state.nodes[ids["Other"]].children).toEqual(newIds);
    for (const id of newIds) expect(state.nodes[id]).toMatchObject({ parentId: ids["Other"], depth: 3, title: "" });
  });

  test("addSlots is a no-op on a node with children, with the wrong count, or with taken ids", () => {
    const { state, ids } = sample();
    const eight = (p) => Array.from({ length: 8 }, (_, i) => p + i);
    expect(Ops.apply(state, { op: "addSlots", parentId: ids["Driver"], ids: eight("a") })).toBe(false);
    expect(Ops.apply(state, { op: "addSlots", parentId: ids["Other"], ids: eight("b").slice(0, 7) })).toBe(false);
    expect(Ops.apply(state, { op: "addSlots", parentId: ids["Other"], ids: [ids["Step"], ...eight("c").slice(1)] })).toBe(false);
    expect(Ops.apply(state, { op: "addSlots", parentId: "missing", ids: eight("d") })).toBe(false);
    expect(state.nodes[ids["Other"]].children).toEqual([]);
  });

  test("clear empties a node, removes its subtree and dependencies on it", () => {
    const { state, ids } = sample();
    Ops.apply(state, { op: "update", id: ids["Second"], fields: { dependencyId: ids["Action"] } });
    Ops.apply(state, { op: "update", id: ids["Action"], fields: { notes: "x", impact: 5, status: "done" } });
    expect(Ops.apply(state, { op: "clear", id: ids["Action"] })).toBe(true);
    expect(state.nodes[ids["Step"]]).toBeUndefined();
    expect(state.nodes[ids["Action"]]).toMatchObject({ title: "", children: [], notes: "", impact: 3, status: "open" });
    expect(state.nodes[ids["Second"]].dependencyId).toBe(null);
    expect(state.nodes[ids["Driver"]].children).toContain(ids["Action"]);
  });

  test("clear refuses the goal and unknown ops change nothing", () => {
    const { state } = sample();
    const before = plain(state);
    expect(Ops.apply(state, { op: "clear", id: state.rootId })).toBe(false);
    expect(Ops.apply(state, { op: "explode", id: state.rootId })).toBe(false);
    expect(Ops.apply(state, null)).toBe(false);
    expect(plain(state)).toEqual(before);
  });
});
