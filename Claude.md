# Claude

Orientation guide for coding assistants working on Mandala. [Agents.md](Agents.md) holds the rules; this file explains how the code fits together and where to make a given change.

Optimize for a product that moves a person from an unclear goal to an obvious next action — not for feature count.

---

## 1. Mental model

```
Goal ── Drivers (≤ 8) ── Actions (8 per driver) ── Steps (only if needed)
                                   │
                         Decide: Do / Later / Hand off / Drop
                                   │
                    Next move = best ready Do leaf → do it → Review
```

- One map = one tree of nodes in `state.nodes`, rooted at `state.rootId`.
- Four views of that tree: **Map**, **Table**, **Grid** (planner, `index.html`) and **Space** (`space.html`).
- Everything is stored in the browser (IndexedDB). There is no server.
- Behavior to preserve: the canvas is persistent (no drill-down pages), nodes are spatial, focus is camera movement, decomposition is recursive, planning ends in executable leaf actions, maps are independent unless the user links them.

---

## 2. Where things live

| File | Role |
|---|---|
| `index.html` | Planner markup: header, view switcher, Map / Table / Grid, inspector, modals (Ideas, Next, Maps, Review) |
| `app.js` | The planner (one jQuery IIFE, ~4000 lines) |
| `styles.css` | Planner, About, Blog styles; later rules override earlier ones, newest overrides are at the end |
| `storage.js` | `window.MandalaStorage` — IndexedDB access |
| `map-ops.js` | `window.MandalaOps` — edit ops shared by Space and the planner |
| `feedback.js` | `window.MandalaFeedback` — feedback links, error notice, `APP_VERSION` |
| `space.html` / `space.css` | Space page, import map, panel, search, fallbacks |
| `space.js` | Space scene, flights, labels, panel, editing, sync (ES module) |
| `space/model.js` | Pure rules: progress, decisions, blockers, next move, demo map |
| `space/textures.js`, `space/shaders.js` | Procedural textures; GLSL materials |
| `sw.js` | Service worker: precache list, network-first for app code, `CACHE_NAME` |
| `vendor/` | jQuery, idb, three (+ OrbitControls), postprocessing, GSAP — pinned, local |
| `wrangler.jsonc`, `.assetsignore`, `_headers` | Cloudflare static-assets deploy |

### Key functions in `app.js`

- **Startup:** `init` → `initializePlannerStorage` (IndexedDB, legacy migration) → `showEmptyMap` → `bindSyncChannel` → `openDeepLinkedNode`.
- **State:** `defaultState`, `normalizeState` (fills missing fields), `createNode`, `createEightSlots`, `uid`, `mapUid`.
- **Persistence:** `saveState` (debounced) → `persistCurrentMapNow` → `broadcastMapSaved`; `createAutosaveSnapshot`.
- **Rendering:** `renderAll` (layout, edges, nodes, table, grid, minimap, progress), `switchView`, `applyActiveView`.
- **Camera / selection:** `selectNode`, `focusCameraOnNode`, `fitAll`, `navigateMapByArrow`, `panMapByArrow`.
- **Editing:** inline edit via `editingId`, `openInspector`, `updateSelectedDetail`, `clearSelectedNode`, `splitSelected`.
- **Decisions:** `decisionValue`, `hasSuppressedAncestor`, `isNodeBlocked`, `setNodeStatus`, `toggleNodeDone`.
- **Execution:** `openNextModal` + `scoreNode`, `updateQuestProgress`, `openReviewModal`, `renderTriageSummary`.
- **Maps library:** `openMapsModal`, `renderMapsLibrary`, `openStoredMap`, `deleteStoredMap`, relationships (`openMapRelationships`).
- **Backup:** `exportState`, `importMapFile` → `sanitizeImportedMap`.
- **Space link:** the `#spaceViewButton` handler persists, then opens `space.html?map=…&node=…`.

### Key functions in `space.js`

- **Startup:** `boot` → `setupRenderer`, `setupBackdrop`, `bindEvents`, `bindSync` → `loadMaps` → `buildSystem` → `intro`. `boot()` is called at the **end** of the module on purpose (module-level `let`/`const` must be initialized first).
- **Building:** `buildSystem`, `buildChildren`, `makeSun`, `makeBody`, `registerBody`, `pumpTextures` (time-sliced, cached), `applyLook` (decision dimming, hand-off courier), `addRing` / `removeRing`, `disposeSystem`.
- **Derived overlays:** `afterDataChange` → `rebuildDependencyLinks`, `updateNextBeacon`, `updateLabelText`, `renderSystemIndex`.
- **Frame loop:** `tick` → `updateOrbits`, atmospheres, beacon, follow camera, `updateDependencyLinks`, `pick`, `composer.render`, `updateLabels`, `monitorPerformance`.
- **Camera:** `focusBody`, `goOverview`, `startFlight` (spherical path around the sun), `cancelFlight`, `viewDistance`, `overviewOffset`, `syncControlLimits`.
- **Panel:** `showPanel`, `renderMeta`, `renderChildList`, `renderEditor`, `showTitleEditor` / `saveTitle`, `addBranch`, `clearFocused`, `setStatus`.
- **Data:** `commitOps` → `persistOps`; incoming planner saves → `scheduleRefresh` → `applyExternalRecord` → `refreshInPlace` or `rebuildPreservingFocus`.
- **Other:** search (`openSearch`, `renderSearch`), `switchMap`, `goToNext`, `hopSibling`.

---

## 3. How data flows

### Planner only

```
user action → mutate state.nodes → saveState() → (220 ms) persistCurrentMapNow()
            → MandalaStorage.saveMap() → broadcastMapSaved()
            → renderAll()
```

### Edit in Space with the planner open

```
Space: commitOps([op]) → MandalaOps.apply(mapState, op) → redraw
       → persistOps: getMap → apply op to record.state → saveMap
       → BroadcastChannel "mandala-sync": { type: "ops", mapId, ops }
Planner: MandalaOps.apply(state, op) → saveState() → renderAll() → refresh inspector
       → persist → { type: "map-saved", mapId }
Space: scheduleRefresh → getMap → same structure? refreshInPlace : rebuildPreservingFocus
```

The echo is harmless: Space receives `map-saved` for its own change, finds the same structure, and refreshes in place.

---

## 4. Recipes

### Add a node field

1. `createNode` (app.js) and `MandalaOps.blankNode` (map-ops.js).
2. Default in `normalizeState`; validation in `sanitizeImportedMap`.
3. If editable from Space: a case in `cleanField` (map-ops.js) and a control in `space.html` + `renderEditor` / `bindEditor` (space.js).
4. UI in the inspector (index.html + `openInspector` / input handlers) and Table if relevant.
5. README data-model table.

### Add a new kind of edit from Space

Add an op type in `MandalaOps.apply` (validated, all-or-nothing), call it through `commitOps` in Space. The planner picks it up automatically through `bindSyncChannel`. If it adds or removes nodes, `structureSignature` changes and Space rebuilds.

### Change how progress or the next move works

Change `app.js` (`updateQuestProgress`, `openNextModal`, `scoreNode`, `hasSuppressedAncestor`, `isNodeBlocked`) **and** `space/model.js`. Test: the 2D quest progress and the Space sun panel must show the same percentage on the same map; the Next modal and Space's Next must pick the same node.

### Add or change a cached file

Add it to `LOCAL_ASSETS` in `sw.js` (and to the network-first regex if it is app code), then bump `CACHE_NAME` **and** `APP_VERSION` in `feedback.js` to the same value.

### Add a third-party library

Vendor it under `vendor/<name>/` with its license, add a README license-table row, reference it locally (planner: `<script>`; Space: import map entry). Never a CDN. Large or optional libraries are not precached.

### Change Space visuals

- Sizes / orbits: `bodyRadius`, `childRingRadius`, `buildSystem` (`startR`, `gap`).
- Planet looks: `makePlanetTexture` (textures.js), `PLANET_TYPES`, `PALETTE`.
- Decision looks: `LOOK` table + `applyLook`.
- Post-processing: `setupRenderer` (bloom, AgX tone mapping, vignette, chromatic aberration).
- Label rules: `labelVisibility`, `labelPriority`, `updateLabels`.

### Add a planner button

Add it to `#plannerActions` in `index.html` and bind it in `bindPlannerEvents`. Then check that the view switcher still does not cover it at 1600 / 1240 / 1100 / 900 / 761 px (rules at the end of `styles.css`).

### Deploy

Push to `main` (Cloudflare Builds deploys it if connected) or run `npx wrangler deploy`. Keep non-public files in `.assetsignore`.

---

## 5. Gotchas

- **Two copies of some logic** (planner vs Space vs map-ops) — see the table in Agents.md §3.5. Forgetting one side makes 2D and 3D disagree.
- **Module order in `space.js`:** don't call anything at the top of the module that touches `let`/`const` declared later (it throws a TDZ error and Space shows its fallback). Keep `boot()` at the bottom.
- **GSAP `autoAlpha` sets `visibility: hidden`** on the first frame; an element hidden that way cannot take focus. Animate `opacity` when you need to focus something inside (see `openSearch`).
- **`structureSignature`** decides in-place refresh vs rebuild. Anything that changes which bodies exist (titles becoming empty/filled, children lists) must change it.
- **Texture cache:** `disposeSystem()` keeps cached planet textures; only `disposeSystem(true)` (map switch) drops them.
- **Inputs being typed in are never refreshed** from sync (planner inspector, Space panel). Preserve that when adding fields.
- **Service worker staleness:** after changing app files, a page may serve the old copy once. Bump the shared version.
- **`html_handling: "none"`** in `wrangler.jsonc` is intentional: redirects from `/space.html` to `/space` would break the service-worker cache.
- **Data is per origin:** localhost, the workers.dev URL and any custom domain each have their own maps.
- **Feedback links never include map contents.** Keep it that way when touching `feedback.js`.
- **Grid** is hidden under 1024 px and falls back to Map on resize.

---

## 6. UI direction

Warm, friendly, personal, playful without being childish, spatial, readable, smooth but not theatrical. Closer to a lightweight colorful game or a creative studio wall than a SaaS dashboard.

- Calm while choosing (space, natural colors, gentle motion); bright when completing (check-offs, bounded confetti, Space's golden rings and bursts).
- Hierarchy: Goal strongest, Driver medium, Action lighter, Step smallest — never by color alone.
- Avoid marketing heroes inside the canvas, card dashboards, heavy glass, noisy animation, clutter.
- No fake cultural decoration.
- Planner animations: CSS transform/opacity. Space may use GSAP and WebGL, but stays smooth on phones.

---

## 7. Testing

`npm test` runs everything (Playwright, ~1.5 min); `npm run test:unit` takes under a second. Structure:

- `tests/unit/` — no browser: `space/model.js` is imported directly, `map-ops.js` is loaded in a Node `vm` with a fake `window`, `release.spec.js` reads files (versions, precache list, CDNs, `.assetsignore`, licenses).
- `tests/e2e/` — Chromium with SwiftShader. `fixtures.js` routes `http://mandala.test/**` to the repository files (no server), fails a test on any console error (`page.allowErrors()` opts out), and provides `seedMap`, `readMap`, `listMaps`, `openPlanner`, `openSpace`, `focusInSpace`, `clickNode`, `domClick`, `labelTexts`, `labelTag`.
- `tests/fixtures/maps.js` — `buildMap(spec)` from a nested spec (ids `n0`, `n1`, …; `blockedBy` by title), `marathonMap()`, and seeded `randomMap(seed)`.

Writing tests that stay green:

- Wait on state, not time: `expect(locator).toHaveText(...)`, `expect.poll(...)`; avoid `waitForTimeout`.
- Click map nodes with `clickNode` (dispatches the DOM event) — nodes outside the visible canvas make `force` clicks miss. Moving Space labels: `domClick`.
- Space tests use `reducedMotion: "reduce"` (shorter flights); keep one full-motion check.
- The Maps dialog opens asynchronously: wait for it to be visible before interacting.
- Device presets like `iPhone 13` ask for WebKit; drop `defaultBrowserType` to stay on Chromium.

The suite already caught a real divergence: Space ignored titled nodes under an emptied slot when counting progress, the planner did not. Keep adding cases like that.

## 8. Roadmap notes

- AI should first improve node quality (suggest drivers/actions, rewrite as controllable action, split, find overlap/missing drivers, critique), with structured output and confirmation before applying.
- Possible next steps for Space: dragging/collapsing in 3D, a "map of maps" galaxy built from `mapLinks`.
- Optional sync/accounts only after repeated real use proves the need.

Mandala is itself a productivity project. Keep changes small, ship them, dogfood them, and let real usage decide the next feature.
