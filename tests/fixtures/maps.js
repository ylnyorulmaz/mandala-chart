// Map states for tests. Every node carries the same fields as createNode()
// in app.js / MandalaOps.blankNode() in map-ops.js.

function blank(id, parentId, depth) {
  return {
    id,
    title: "",
    parentId,
    depth,
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
    createdAt: 1700000000000
  };
}

/**
 * Build a map from a nested spec:
 *   { title, status?, decision?, impact?, effort?, duration?, notes?, blockedBy?: "<title>", children?: [...] }
 * Ids are "n0", "n1", … in depth-first order. Returns { state, ids } where
 * ids maps each title to its id.
 */
export function buildMap(spec) {
  const nodes = {};
  const ids = {};
  const pendingBlocks = [];
  let counter = 0;

  const add = (item, parentId, depth) => {
    const id = "n" + counter++;
    const node = blank(id, parentId, depth);
    for (const key of ["title", "status", "decision", "impact", "effort", "duration", "notes", "delegatedTo", "deferUntil"]) {
      if (item[key] !== undefined) node[key] = item[key];
    }
    nodes[id] = node;
    if (node.title) ids[node.title] = id;
    if (item.blockedBy) pendingBlocks.push([id, item.blockedBy]);
    if (parentId) nodes[parentId].children.push(id);
    (item.children || []).forEach((child) => add(child, id, depth + 1));
    return id;
  };

  const rootId = add(spec, null, 0);
  for (const [id, blockerTitle] of pendingBlocks) nodes[id].dependencyId = ids[blockerTitle];
  return { state: { rootId, nodes, version: 5 }, ids };
}

/** Small realistic map used by the planner, Space and sync tests. */
export function marathonMap() {
  const actions = (driver, extra = {}) => [1, 2, 3].map((n) => ({ title: `${driver} task ${n}`, status: n === 1 ? "done" : "open", impact: 2 + n, ...(extra[n] || {}) }));
  return buildMap({
    title: "Run a marathon",
    children: [
      { title: "Training plan", children: actions("Training plan") },
      { title: "Nutrition", children: actions("Nutrition") },
      {
        title: "Recovery",
        children: [
          { title: "Recovery task 1", status: "open", impact: 3, children: [{ title: "Foam roll" }] },
          { title: "Recovery task 2", impact: 4 },
          { title: "Recovery task 3", impact: 5 }
        ]
      },
      { title: "Gear", decision: "defer", children: actions("Gear") },
      { title: "" }, { title: "" }, { title: "" }, { title: "" }
    ]
  });
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A random but reproducible map that exercises every rule the planner and
 * Space must agree on: statuses, all four decisions, suppressed branches,
 * blockers (resolved and not), estimates, steps, empty slots, and titled
 * nodes under an emptied parent.
 */
export function randomMap(seed) {
  const r = rng(seed);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const status = () => pick(["open", "open", "open", "doing", "done", "done"]);
  const decision = () => pick(["do", "do", "do", "do", "defer", "delegate", "delete"]);
  const score = () => 1 + Math.floor(r() * 5);

  const drivers = [];
  for (let d = 1; d <= 8; d++) {
    if (r() < 0.15) {
      drivers.push({ title: "" });
      continue;
    }
    const actions = [];
    const actionCount = Math.floor(r() * 7);
    for (let a = 1; a <= actionCount; a++) {
      const steps = [];
      if (r() < 0.25) {
        const stepCount = 1 + Math.floor(r() * 3);
        for (let s = 1; s <= stepCount; s++) {
          steps.push({ title: `S${seed}.${d}.${a}.${s}`, status: status(), decision: decision(), impact: score(), effort: score(), duration: r() < 0.3 ? String(10 + Math.floor(r() * 40)) : "" });
        }
      }
      actions.push({
        title: r() < 0.08 ? "" : `A${seed}.${d}.${a}`,
        status: status(),
        decision: decision(),
        impact: score(),
        effort: score(),
        duration: r() < 0.3 ? String(10 + Math.floor(r() * 40)) : "",
        children: steps
      });
    }
    drivers.push({
      // an emptied driver that still has titled actions below it
      title: r() < 0.1 ? "" : `D${seed}.${d}`,
      decision: r() < 0.15 ? pick(["defer", "delegate", "delete"]) : "do",
      children: actions
    });
  }

  const { state, ids } = buildMap({ title: `Random goal ${seed}`, children: drivers });

  // sprinkle blockers between titled nodes (never on an ancestor)
  const titled = Object.values(state.nodes).filter((n) => n.title && n.depth >= 2);
  for (const node of titled) {
    if (r() < 0.2) {
      const blocker = pick(titled);
      let isAncestorOrSelf = false;
      for (let cur = node; cur; cur = state.nodes[cur.parentId]) if (cur.id === blocker.id) isAncestorOrSelf = true;
      if (!isAncestorOrSelf) node.dependencyId = blocker.id;
    }
  }
  return { state, ids };
}
