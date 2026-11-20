# Agents

Working rules for coding agents and automated contributors in this repository. Humans are welcome to follow them too.

The product intent matters more than adding features. When in doubt, do less, keep it local-first, and keep the map understandable.

---

## 1. Read first

Before a substantial change, read:

1. [README.md](README.md) — what the app does today, architecture, data model, deploy.
2. [Claude.md](Claude.md) — code orientation: where things live and how to change them.
3. [Product.md](Product.md) — vision and philosophy.
4. [ExecutionFramework.md](ExecutionFramework.md) — the decision / next-move model.
5. [ProductRoadmap.md](ProductRoadmap.md) — what comes next and what deliberately does not.

Then ask:

> Does this improve clarity, decomposition, navigation, prioritization, or execution?

If not, it probably does not belong yet.

---

## 2. Product summary

Mandala is a local-first execution map:

**Goal → Drivers → Actions → Steps → Next move**

Visible loop: **Break it down → Decide → Do next → Review**.

Views: Map, Table, Grid (2D planner, `index.html`) and Space (3D, `space.html`). They are projections of one data model.

---

## 3. Hard constraints

### 3.1 No runtime CDNs

Never load code, styles or fonts at runtime from jsDelivr, unpkg, cdnjs, Google-hosted libraries, code.jquery.com or any other third-party host. A CDN/SRI failure broke this app once.

If a library is needed:

1. vendor the exact distributable into `vendor/`,
2. pin and record the version,
3. add its license file and a row to the README license table,
4. reference it with a relative path (or the Space import map),
5. decide whether `sw.js` should precache it (planner essentials: yes; large optional libraries: cache on first use).

### 3.2 Keep the stack

HTML, CSS, plain JavaScript, jQuery 3.7.1 (planner), vendored `idb`, IndexedDB, a service worker, a web manifest. Space uses native ES modules and an import map — still **no build step**.

Do not migrate to React, Vue, Svelte, Angular, TypeScript, Tailwind or a bundler unless explicitly asked or there is a demonstrated technical need. A rewrite is not a feature.

Three.js, postprocessing and GSAP are allowed **only in Space** (`space.html`). Do not load them in the planner; the planner's animations stay CSS transform/opacity.

### 3.3 Local-first

Core planning must work without login, account, API key, server or network. No analytics or tracking. Nothing about a user's maps may leave the browser automatically.

### 3.4 One data model

Map, Table, Grid and Space read and write the same node objects. Never introduce a parallel model for a view.

### 3.5 Mirrored logic stays mirrored

Some rules exist in more than one file on purpose (the planner is a classic script, Space is ES modules, and both must agree). Change them together:

| Rule | Planner (`app.js`) | Mirror |
|---|---|---|
| Decision value, suppressed ancestors, blocked | `decisionValue`, `hasSuppressedAncestor`, `isNodeBlocked` | `space/model.js` |
| Quest / progress counting | `updateQuestProgress` | `space/model.js` → `isActionableLeaf`, `leafStats` |
| Next move filter and score | `openNextModal`, `scoreNode` | `space/model.js` → `nextActionNode`, `scoreNode` |
| New node fields | `createNode` | `map-ops.js` → `blankNode` |
| Eight slots | `createEightSlots` | `map-ops.js` → `addSlots` op |
| Clear a node | `clearSelectedNode` | `map-ops.js` → `clear` op |
| "Blocked by" candidates | `populateDependencyOptions` | `map-ops.js` → `dependencyCandidates` |
| Import field validation | `sanitizeImportedMap` | `map-ops.js` → `cleanField` (same limits) |

### 3.6 Tests guard the mirrors

`tests/e2e/parity.spec.js` compares planner and Space on seeded random maps; `tests/unit/model.spec.js` and `tests/unit/map-ops.spec.js` pin the shared rules. When you change a mirrored rule, change both sides **and** add a case that would have caught a one-sided change (a unit example, or a seed in `parity.spec.js`).

### 3.7 Versioning the cache

`CACHE_NAME` in `sw.js` and `APP_VERSION` in `feedback.js` share one value (e.g. `mandala-v30`). Bump **both** whenever a cached file changes, and add any new runtime file to `LOCAL_ASSETS` (and to the network-first pattern if it is app code).

---

## 4. Data rules

Nodes are plain JSON. Known fields: `id`, `title`, `parentId`, `depth`, `children`, `status`, `impact`, `effort`, `decision`, `dependencyId`, `delegatedTo`, `deferUntil`, `duration`, `notes`, `collapsed`, `tableCollapsed`, `offsetX`, `offsetY`, `createdAt` (types in the README data model).

- Never store DOM nodes, functions, class instances or Three.js objects in persisted state.
- Internal decision values stay `do / defer / delegate / delete`; the UI shows Do / Later / Hand off / Drop.
- `decision = "delete"` (Drop) never removes or clears a node. Physical clearing is a separate, explicit action.
- Adding a field: add it to `createNode`, `MandalaOps.blankNode`, `normalizeState` defaults, `sanitizeImportedMap`, and (if editable from Space) `cleanField` — and document it in the README.

### State safety

- Preserve backward compatibility; version stored data if the schema changes and provide a migration.
- Fail safely on invalid JSON. Never silently erase a user's map; prefer migration to reset.
- Treat every imported file and every BroadcastChannel message as untrusted input.

---

## 5. Storage invariants

- Planner maps live in IndexedDB (`mandala-local`, schema v2: `maps`, `snapshots`, `meta`, `mapLinks`). UI code calls `MandalaStorage`, not raw IndexedDB.
- First successful start migrates the old single-map `localStorage` state.
- Multiple maps never overwrite each other; starting a new map or importing one is non-destructive.
- Current-map writes are debounced; snapshots are deduplicated, rate-limited, capped at 30 per map; restore saves the current version first.
- Palette preference may stay in `localStorage`.
- If IndexedDB fails, fall back to single-map `localStorage` and tell the user.
- Import always creates a **new** map; it never overwrites an existing one.

### Cross-map structure

- Maps are independent by default; groups and links are optional.
- `map.group` is a loose label; links live in `mapLinks` with canonical types `related`, `before`, `parent` (UI may show After / Child of; normalize on write).
- At most one direct parent; `parent` and `before` stay acyclic.
- Deleting a map deletes its links. Snapshots and restores never touch group metadata or links.
- Never copy map-level links into node state.

---

## 6. Sync invariants (Space ↔ planner)

- Every edit in Space goes through `commitOps` → `MandalaOps.apply` → IndexedDB → `{ type: "ops", mapId, ops }` on the `mandala-sync` BroadcastChannel.
- The planner applies incoming ops with the **same** `MandalaOps.apply`, then `saveState()`. It must not reload the whole record instead (that would drop its own unsaved edits).
- The planner posts `{ type: "map-saved", mapId }` after each successful persist. Space reacts by re-reading the record: in-place refresh if `structureSignature` is unchanged, otherwise rebuild while keeping focus.
- Op ids for new nodes are generated by the sender so both sides create identical nodes.
- Validate everything in `MandalaOps.apply`; an invalid op must be a no-op, never a partial write.
- Do not refresh an input the user is currently typing in (inspector in the planner, panel fields in Space).
- A new kind of edit = a new op type in `map-ops.js`, handled identically on both sides — not an ad-hoc message.

---

## 7. Space invariants

- Goal = sun, drivers = planets on their own orbits, actions = moons, steps = moonlets; empty slots are wireframe ghosts.
- Space never invents data: everything it shows comes from the map plus `space/model.js` rules.
- Grabbing the camera (pointer down, wheel) cancels any flight immediately.
- Keep the planner usable without Space: Space libraries are never loaded by `index.html`.
- Keep fallbacks working: no WebGL 2 → fallback card; no import maps → fallback card (no endless loader).
- Performance: textures are generated in time slices and cached by `type|hex|seed|width`; do not regenerate textures on every edit; keep the adaptive pixel-ratio step-down.
- Reduced motion: shorter flights, no auto-rotate, no chromatic aberration, no pulsing beacon.
- Labels are DOM elements: update only what changed per frame (opacity / transform / z-index caches).

---

## 8. Decision and next-move model

- The 8×8 structure is a decomposition aid, not a 64-item checklist.
- Next move considers only concrete leaf nodes that are titled, unfinished, decided **Do**, **not blocked**, and not under a non-Do ancestor; ties broken by `scoreNode` (impact × 2 − effort, +2 doing, +1 short estimate).
- Later / Hand off / Drop on a parent suppresses its descendants from Next move and from progress.
- Blocked work stays visible but does not compete for Next move.
- Progress must not punish intentionally dropped work.
- Progressive disclosure: Hand off reveals a target; Later reveals a date.
- Do not expose Important/Urgent or Delegatable as permanent fields unless real usage demands it.
- Scoring is a sorting aid; never present fake precision.

---

## 9. Planner invariants

### Navigation

- Arrow keys hop to the nearest **rendered** node in that direction; with no selection, start from the viewport center.
- Shift + Arrow pans without changing selection; clicking empty canvas clears selection.
- Any direct camera input cancels a running camera animation.
- Coalesce pointer camera updates with `requestAnimationFrame`; keep pinch anchored under the gesture midpoint; node-drag thresholds are in screen pixels.

### Grid

- Exactly 9×9; goal at the center; the eight drivers around it in clockwise order N, NE, E, SE, S, SW, W, NW (same as Map).
- Each driver owns an outer 3×3 block (repeated at its center) holding its first eight children; deeper levels show a count only.
- Hidden below 1024 px; if a resize makes it unavailable, fall back to Map.

### Layout

- The view switcher and the planner actions must never overlap, on any device's fonts. Above 760 px the switcher sits on its own row and the actions are capped so they never reach the zoom toolbar (they scroll sideways if needed); phones use the dock layout. Don't reintroduce pixel-exact breakpoints — `tests/e2e/layout.spec.js` checks every width with normal and wide fonts.

### Palettes

- Curated set: Light, Dark, Sage, Dawn; stored under the existing theme key; Dark keeps the `body.dark` class.
- Every palette must stay readable in Map, Table, Grid, Inspector, modals and mobile controls.

---

## 10. UX principles

- **Overview first, focus second.** No page-by-page wizards; focus is camera movement that keeps context.
- **Hierarchy is visible** — and never encoded by color alone.
- **Warm, playful, calm.** A lightweight game, not an enterprise dashboard: warm natural colors, tactile rounded controls, direct check-off, visible progress, short bounded celebrations. Calm while thinking, bright when completing.
- No fake cultural decoration (kanji, bamboo, lanterns, cherry blossoms, faux calligraphy). Express the influence through space, rhythm and flow.
- Motion explains structure (expand, focus, create, collapse); remove celebration DOM afterwards; respect reduced motion.
- Avoid clutter: spacing, collapse, zoom-dependent detail, quiet connectors, clear selection.
- Mobile is first-class: touch pan, pinch, inline edit, inspector and panels as bottom sheets, safe areas, PWA mode.

---

## 11. Security and privacy

- Never commit secrets, API keys or tokens. There are none in this app; keep it that way.
- Insert user content with `textContent` / jQuery `.text()`; when building HTML strings, escape with the existing helpers. No `eval`, no `new Function` in app code.
- Imported JSON is untrusted: validate shape, types, ranges and sizes (`sanitizeImportedMap`).
- Feedback / error reports (`feedback.js`) may include page, version, browser, screen and WebGL support — **never map contents** — and are only sent when the user submits the GitHub form.
- Do not add analytics, trackers or third-party embeds.

---

## 12. Accessibility

- Keyboard access for core controls, visible focus, semantic buttons, useful labels.
- Radio-like groups (status switch, decision / impact / effort segments) use `role="radio"` / `aria-checked` and arrow keys.
- Space announces focus changes through its `aria-live` region and offers keyboard routes (index list, search, arrows).
- Sufficient contrast in every palette; color is never the only signal; respect `prefers-reduced-motion`.

---

## 13. Performance

- No full-tree re-render on pointer move; use transform-based pan/zoom, event delegation, `requestAnimationFrame`.
- Avoid layout thrash (read, then write), large shadows/filters on many nodes, per-frame listeners.
- Space: reuse geometries, dispose GPU resources on rebuild (except cached textures), keep labels cheap.

---

## 14. AI integration (future)

There is no live AI provider; **Ideas** uses local demo suggestions. When AI is added:

- isolate provider code, return structured data, validate it, never trust generated ids,
- show proposed changes and require confirmation before applying them; never overwrite user work silently,
- handle timeouts and malformed output; the app must work without AI,
- AI critiques and assists — Mandala must not become a chat wrapper.

---

## 15. Git and deploy workflow

- Work on a branch; merge to `main` when `npm test` and the checks below pass. `main` is the production branch; the **Tests** workflow runs on every push to it and on pull requests.
- With Cloudflare Builds connected, every push to `main` deploys (`npx wrangler deploy`, config in `wrangler.jsonc`). Without it, deploy manually with the same command.
- Anything that must not be public on the site goes into `.assetsignore` (Markdown, `docs/`, `.github/`, `LICENSE`, config already are).
- Keep commits focused, with messages that explain *why*.
- Never commit `.wrangler/`, `node_modules/`, `test-results/`, `playwright-report/`, credentials or other local artefacts.

---

## 16. Before and after editing

`npm test` must pass before a merge (CI runs it on pushes to `main` and on pull requests). Add or update tests for the behavior you change. The list below is what the suite covers plus what still needs a human.

Before:

1. understand the current interaction and read the relevant code,
2. find the mirrored places (section 3.5),
3. define the smallest change; preserve behavior unless replacing it on purpose.

After — verify at least:

1. no CDN references and no new network calls,
2. `sw.js` cache entries and the shared version bumped if cached files changed,
3. fresh IndexedDB and legacy `localStorage` migration,
4. multiple maps, snapshot restore, groups and links with cycle guards,
5. Save → Import round trip; a broken file changes nothing,
6. Map / Table / Grid sync and the 1024 px Grid breakpoint,
7. the view switcher does not cover planner actions at any width (layout tests, normal and wide fonts),
8. pan / zoom / focus / arrow navigation and editing,
9. decisions, blockers, Next move and progress agree between planner and Space,
10. Space: flights, search, Next, every edit type, sync with an open planner tab (edits survive its autosave), fallbacks,
11. all four palettes, reduced motion, a narrow phone viewport,
12. offline reload after one visit,
13. no console errors,
14. documentation updated when behavior changed (README, this file, Claude.md).

---

## 17. Anti-patterns

Be suspicious of dashboards, streaks, points, badges, elaborate analytics, team features, notifications, integrations and account systems unless real user behavior demonstrates the need.

Do not let building Mandala become a sophisticated way of avoiding the work it is meant to help with.

---

## 18. Definition of done

A change is done when:

- `npm test` passes, with tests added for the new behavior,
- the interaction works on desktop and phone,
- existing map data remains safe,
- planner and Space still agree,
- the UI remains understandable,
- no unnecessary dependency was introduced,
- the documentation matches the behavior.

When uncertain between two implementations, prefer the one that is simpler, local-first, reversible, understandable without a build tool, and aligned with execution rather than feature accumulation.
