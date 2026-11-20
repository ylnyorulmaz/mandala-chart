/*
 * MandalaOps — the edits that Space (space.html) and the planner (index.html)
 * both understand. Space applies an op to its own copy of the map, writes it to
 * IndexedDB and broadcasts it on the "mandala-sync" BroadcastChannel; an open
 * planner tab applies the same op to its in-memory state, so neither side
 * overwrites the other.
 *
 * Keep these in step with app.js: blankNode ↔ createNode, addSlots ↔
 * createEightSlots, clear ↔ clearSelectedNode, dependencyCandidates ↔
 * populateDependencyOptions.
 */
(function (global) {
  "use strict";

  var DECISIONS = ["do", "defer", "delegate", "delete"];
  var STATUSES = ["open", "doing", "done"];
  var TEXT_LIMITS = { title: 180, notes: 1200, delegatedTo: 120 };

  function newId() {
    return "n_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function blankNode(id, parentId, depth) {
    return {
      id: id,
      title: "",
      parentId: parentId || null,
      depth: depth || 0,
      children: [],
      status: "open",
      impact: 3,
      effort: 3,
      decision: "do",
      dependencyId: null,
      delegatedTo: "",
      deferUntil: "",
      duration: "",
      notes: "",
      collapsed: false,
      tableCollapsed: false,
      offsetX: 0,
      offsetY: 0,
      createdAt: Date.now()
    };
  }

  function titleOf(node) {
    return node && typeof node.title === "string" ? node.title.trim() : "";
  }

  function isDescendantOf(state, candidateId, ancestorId) {
    var cursor = state.nodes[candidateId];
    while (cursor && cursor.parentId) {
      if (cursor.parentId === ancestorId) return true;
      cursor = state.nodes[cursor.parentId];
    }
    return false;
  }

  /** Nodes that `node` may be blocked by: titled, not itself, not one of its descendants. */
  function dependencyCandidates(state, node) {
    return Object.keys(state.nodes)
      .map(function (id) { return state.nodes[id]; })
      .filter(function (candidate) {
        return candidate && candidate.id !== node.id && titleOf(candidate) &&
          !isDescendantOf(state, candidate.id, node.id);
      });
  }

  function cleanField(state, node, key, value) {
    switch (key) {
      case "title":
      case "notes":
      case "delegatedTo":
        return { ok: true, value: String(value == null ? "" : value).slice(0, TEXT_LIMITS[key]) };
      case "status":
        return { ok: STATUSES.indexOf(value) !== -1, value: value };
      case "decision":
        return { ok: DECISIONS.indexOf(value) !== -1, value: value };
      case "impact":
      case "effort": {
        var n = parseInt(value, 10);
        return { ok: n >= 1 && n <= 5, value: n };
      }
      case "duration": {
        if (value === "" || value == null) return { ok: true, value: "" };
        var minutes = parseInt(value, 10);
        return { ok: minutes >= 0 && minutes <= 1440, value: String(minutes) };
      }
      case "deferUntil":
        return { ok: value === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(value)), value: String(value || "") };
      case "dependencyId":
        if (!value) return { ok: true, value: null };
        return {
          ok: dependencyCandidates(state, node).some(function (c) { return c.id === value; }),
          value: value
        };
      default:
        return { ok: false };
    }
  }

  function removeRecursive(state, id) {
    var node = state.nodes[id];
    if (!node) return;
    (node.children || []).forEach(function (childId) { removeRecursive(state, childId); });
    delete state.nodes[id];
  }

  /** Apply one op to `state` in place. Returns true when something changed. */
  function apply(state, op) {
    if (!state || !state.nodes || !op) return false;

    if (op.op === "update") {
      var node = state.nodes[op.id];
      if (!node || !op.fields) return false;
      var changed = false;
      Object.keys(op.fields).forEach(function (key) {
        var clean = cleanField(state, node, key, op.fields[key]);
        if (!clean.ok || node[key] === clean.value) return;
        node[key] = clean.value;
        changed = true;
      });
      return changed;
    }

    if (op.op === "addSlots") {
      var parent = state.nodes[op.parentId];
      var ids = Array.isArray(op.ids) ? op.ids : [];
      if (!parent || (parent.children && parent.children.length) || ids.length !== 8) return false;
      if (ids.some(function (id) { return !id || state.nodes[id]; })) return false;
      if (!parent.children) parent.children = [];
      ids.forEach(function (id) {
        state.nodes[id] = blankNode(id, parent.id, (parent.depth || 0) + 1);
        parent.children.push(id);
      });
      parent.collapsed = false;
      return true;
    }

    if (op.op === "clear") {
      var target = state.nodes[op.id];
      if (!target || op.id === state.rootId) return false;
      (target.children || []).slice().forEach(function (childId) { removeRecursive(state, childId); });
      target.children = [];
      target.title = "";
      target.status = "open";
      target.impact = 3;
      target.effort = 3;
      target.decision = "do";
      target.dependencyId = null;
      delete target.urgency;
      delete target.important;
      delete target.urgent;
      delete target.delegatable;
      target.delegatedTo = "";
      target.deferUntil = "";
      target.duration = "";
      target.notes = "";
      target.collapsed = false;
      target.tableCollapsed = false;
      target.offsetX = 0;
      target.offsetY = 0;
      Object.keys(state.nodes).forEach(function (id) {
        if (state.nodes[id] && state.nodes[id].dependencyId === op.id) state.nodes[id].dependencyId = null;
      });
      return true;
    }

    return false;
  }

  global.MandalaOps = {
    apply: apply,
    newId: newId,
    blankNode: blankNode,
    dependencyCandidates: dependencyCandidates
  };
})(window);
