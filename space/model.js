/* Map-state rules for Space.
 *
 * These mirror app.js on purpose — decisionValue, hasSuppressedAncestor,
 * isNodeBlocked, updateQuestProgress, openNextModal and scoreNode — so the 2D
 * planner and the 3D view always agree on progress and on the next move.
 * If one side changes, change the other. */

export function nodeTitle(node) {
  return node && typeof node.title === "string" && node.title.trim() ? node.title.trim() : "";
}

export function filledChildren(state, node) {
  return (node.children || []).map((id) => state.nodes[id]).filter((c) => c && nodeTitle(c));
}

export function decisionValue(node) {
  return node && ["do", "defer", "delegate", "delete"].indexOf(node.decision) !== -1 ? node.decision : "do";
}

export function hasSuppressedAncestor(state, node) {
  let cursor = node && node.parentId ? state.nodes[node.parentId] : null;
  while (cursor) {
    if (cursor.depth >= 1 && decisionValue(cursor) !== "do") return true;
    cursor = cursor.parentId ? state.nodes[cursor.parentId] : null;
  }
  return false;
}

export function isNodeBlocked(state, node) {
  if (!node || !node.dependencyId) return false;
  const dependency = state.nodes[node.dependencyId];
  if (!dependency) return false;
  return !(dependency.status === "done" || decisionValue(dependency) === "delete");
}

/** How a node should be dimmed in space: its own decision wins over an ancestor's. */
export function suppressionOf(state, node) {
  const own = decisionValue(node);
  if (own === "delete") return "drop";
  if (own === "defer") return "later";
  if (own === "delegate") return "handoff";
  return hasSuppressedAncestor(state, node) ? "inherited" : null;
}

export function isActionableLeaf(state, node) {
  return !!(node && nodeTitle(node) && node.depth >= 2 && !filledChildren(state, node).length &&
    decisionValue(node) === "do" && !hasSuppressedAncestor(state, node));
}

/**
 * Done / total of the actionable leaves below `node` (same rule as the 2D
 * quest progress). Walks every descendant — also through emptied slots, whose
 * titled children the planner still counts.
 */
export function leafStats(state, node) {
  let total = 0;
  let done = 0;
  const walk = (n) => {
    if (n !== node && isActionableLeaf(state, n)) {
      total++;
      if (n.status === "done") done++;
    }
    (n.children || []).forEach((id) => {
      if (state.nodes[id]) walk(state.nodes[id]);
    });
  };
  walk(node);
  return { total, done };
}

export function scoreNode(node) {
  const impact = parseInt(node.impact || 3, 10);
  const effort = parseInt(node.effort || 3, 10);
  let score = impact * 2 - effort;
  if (node.status === "doing") score += 2;
  if (node.duration && parseInt(node.duration, 10) <= 30) score += 1;
  return score;
}

/** The single best ready action, exactly as the planner's "Next move" picks it. */
export function nextActionNode(state) {
  const candidates = Object.keys(state.nodes)
    .map((id) => state.nodes[id])
    .filter((node) => node && nodeTitle(node) &&
      node.status !== "done" &&
      !filledChildren(state, node).length &&
      node.depth >= 2 &&
      decisionValue(node) === "do" &&
      !hasSuppressedAncestor(state, node) &&
      !isNodeBlocked(state, node));
  candidates.sort((a, b) => scoreNode(b) - scoreNode(a));
  return candidates[0] || null;
}

/** Changes only when bodies would be added, removed, re-parented or switch empty/filled. */
export function structureSignature(state) {
  return state.rootId + "#" + Object.keys(state.nodes).sort().map((id) => {
    const n = state.nodes[id];
    return id + ":" + (nodeTitle(n) ? 1 : 0) + ":" + (n.children || []).join(",");
  }).join("|");
}

export function demoState() {
  const nodes = {};
  let n = 0;
  const make = (title, parentId, depth, extra) => {
    const id = "demo_" + (n++);
    nodes[id] = Object.assign({
      id, title, parentId, depth, children: [], status: "open",
      impact: 3, effort: 3, decision: "do", notes: "", duration: "", dependencyId: null
    }, extra || {});
    if (parentId) nodes[parentId].children.push(id);
    return id;
  };

  const root = make("Launch my first product", null, 0);
  const plan = [
    ["Product readiness", ["List launch blockers", "Test the main user flow", "Fix mobile issues", "Check performance"]],
    ["Offer & positioning", ["Write one clear promise", "Create one proof example", "Choose one target audience"]],
    ["Pricing & payment", ["Choose one simple price", "Set up payment link", "Run one real payment test"]],
    ["Ideal customer", ["Write ICP in one sentence", "Find 10 matching prospects", "Rank by relevance"]],
    ["Outreach", ["Write one short message", "Send to 5 prospects", "Follow up after 3 days", "Track replies"]],
    ["Launch content", ["Publish one demo", "Post in one relevant community"]],
    ["Measurement", ["Track clicks and replies", "Review what worked"]],
    ["", []]
  ];

  const ids = {};
  plan.forEach(([title, actions], k) => {
    const d = make(title, root, 1, k === 2 ? { status: "done" } : (k === 6 ? { decision: "defer" } : null));
    actions.forEach((a, i) => {
      const extra = { status: (i + k) % 3 === 0 ? "done" : (i === 1 ? "doing" : "open"), impact: 2 + ((i + k) % 4), effort: 1 + ((i * 2 + k) % 4) };
      if (a === "Fix mobile issues") extra.decision = "delegate";
      if (a === "Post in one relevant community") extra.decision = "delete";
      ids[a] = make(a, d, 2, extra);
      if (a === "Test the main user flow") {
        make("Sign up as a new user", ids[a], 3, { status: "done" });
        make("Create first project", ids[a], 3, { impact: 5, effort: 1, duration: "20" });
        make("Export the result", ids[a], 3);
      }
    });
  });
  nodes[ids["Send to 5 prospects"]].dependencyId = ids["Write one short message"];
  nodes[ids["Write one short message"]].status = "open";

  return { rootId: root, nodes, version: 5 };
}
