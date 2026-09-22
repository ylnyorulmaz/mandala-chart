# Agents

## Purpose

This file defines working rules for coding agents and automated contributors operating in this repository.

Read these files before making substantial changes:

1. `Product.md`
2. `ProductRoadmap.md`
3. `README.md`
4. `Cloudy.md`

The product intent matters more than adding features.

---

## Product summary

Mandala is a local-first zoomable execution map.

The core flow is:

**Goal → Drivers → Actions → Smaller Steps → Next Action**

The map must remain spatial, understandable, lightweight, and focused on execution.

---

## Current stack

Use the existing stack unless explicitly asked to change it:

- HTML
- CSS
- JavaScript
- jQuery 3.7.1
- SVG
- localStorage
- Service Worker
- Web App Manifest

There is currently no backend and no build system.

---

## Hard technical constraints

### No runtime CDNs

Do not add runtime dependencies from:

- jsDelivr,
- unpkg,
- cdnjs,
- Google-hosted libraries,
- code.jquery.com,
- other CDN hosts.

If a library is required, vendor the exact distributable file into the repository.

Document:

- library name,
- version,
- license,
- source.

### Do not replace the stack casually

Do not migrate to:

- React,
- Vue,
- Svelte,
- Angular,
- TypeScript,
- Tailwind,
- a bundler,

unless explicitly requested or there is a demonstrated technical need.

A rewrite is not a feature.

### Keep the core local-first

Core planning must continue to work without:

- login,
- cloud account,
- API key,
- network connection.

### Preserve PWA behavior

When changing cached assets:

- update `sw.js`,
- bump the cache version when necessary,
- include new local runtime assets,
- verify stale cached files cannot break the app.

---

## UX principles

### Overview first, focus second

The whole map should remain understandable.

Do not turn the product back into a page-by-page wizard.

### Camera navigation, not destructive navigation

Clicking a node should focus or center it while preserving spatial context.

### Do not hide hierarchy

Goal, Driver, Action, and Step should be visually distinguishable.

### Keep the visual language warm and personal

Mandala should not look like an enterprise dashboard.

Prefer a lightweight game-like visual language: vibrant warm colors, tactile rounded controls, obvious direct manipulation, visible completion progress, friendly microcopy, and short non-blocking celebrations. Any meaningful node should be easy to mark done directly.

Animations must stay cheap and smooth. Prefer transform and opacity. Keep confetti bursts short and bounded, remove particles afterward, respect prefers-reduced-motion, and do not add animation libraries merely for spectacle.

Avoid cold corporate blue as the dominant language, dense admin chrome, and unnecessary uppercase UI text.

### Avoid visual clutter

A graph can become unreadable quickly.

Prefer:

- sensible spacing,
- branch collapse,
- zoom-dependent detail,
- quiet connectors,
- clear selection states.

### Animation must communicate structure

Animations should explain:

- expansion,
- focus,
- creation,
- collapse.

Avoid decorative motion that slows task entry.

### Mobile is a first-class target

Test:

- touch pan,
- pinch zoom,
- inline editing,
- node focus,
- inspector,
- safe areas,
- PWA mode.

---

## Data rules

Each node should remain serializable.

A node may contain fields such as:

- `id`
- `title`
- `parentId`
- `children`
- `depth` / `type`
- `x`
- `y`
- `status`
- `impact`
- `effort`
- `urgency`
- `duration`
- `notes`
- collapse state

Do not store DOM elements, functions, or non-serializable state inside the persistent data model.

---

## State safety

When changing persistence:

- preserve backward compatibility where reasonable,
- version stored data if the schema changes,
- fail safely on invalid JSON,
- do not silently erase a user's map,
- prefer migration over destructive reset.

Before changing the localStorage key or schema, provide a migration path.

---

## AI integration rules

There is currently no live AI provider.

When AI is added:

- keep provider-specific code isolated,
- return structured data,
- validate model output,
- never trust generated node IDs,
- never allow AI to overwrite user work silently,
- require confirmation before mass changes,
- handle timeouts and malformed JSON,
- make the product usable when AI is unavailable.

AI should critique and assist.

It should not turn Mandala into a generic chat wrapper.

---

## Security rules

- Never commit API keys.
- Never store private keys in source.
- Do not put privileged secrets in client-side JavaScript.
- Treat all imported JSON as untrusted input.
- Escape user-created content before inserting HTML.
- Avoid `eval`, `new Function`, or unsafe HTML injection.
- Use `textContent` / jQuery text methods where possible.

---

## Accessibility

At minimum:

- keyboard-accessible core controls,
- visible focus state,
- semantic buttons,
- useful aria labels,
- sufficient contrast,
- respect `prefers-reduced-motion`,
- do not make color the only state indicator.

---

## Performance

The map should feel immediate.

Avoid:

- expensive full-tree re-rendering on every pointer move,
- layout thrashing,
- huge shadows/filters on hundreds of nodes,
- unnecessary event listeners per frame.

Prefer:

- requestAnimationFrame for camera transforms,
- event delegation,
- throttled/minimal line redraws,
- transform-based pan/zoom,
- DOM reuse where practical.

---

## Code-change discipline

Before editing:

1. understand the current interaction,
2. inspect relevant files,
3. define the smallest change,
4. preserve existing behavior unless intentionally replacing it.

After editing:

1. verify there are no CDN references,
2. verify PWA cache entries if assets changed,
3. test fresh IndexedDB,
4. test migration from existing localStorage state,
5. test multiple maps and snapshot restore,
6. test desktop,
7. test narrow mobile viewport,
8. test pan/zoom/focus,
9. test editing,
10. test export,
11. test basic offline reload when relevant.

---

## Product anti-patterns

Do not add features merely because other productivity products have them.

Be suspicious of:

- dashboards,
- streaks,
- points,
- badges,
- elaborate analytics,
- team features,
- notifications,
- integrations,
- account systems,

unless user behavior demonstrates a need.

---

## Definition of done

A change is not done when it compiles.

It is done when:

- the interaction works,
- existing map data remains safe,
- the UI remains understandable,
- mobile is not broken,
- no unnecessary dependency was introduced,
- documentation is updated when behavior changes.

---

## Agent decision rule

When uncertain between two implementations, prefer the one that is:

1. simpler,
2. local-first,
3. reversible,
4. understandable without a build tool,
5. aligned with execution rather than feature accumulation.


## Decision and execution model

Mandala is not a 64-item completion checklist.

The product model is:

**Break it down → Decide → Do next → Review**

Implementation rules:

- preserve the 8×8 structure as a decomposition constraint, not as an instruction to complete everything,
- keep stable internal decision values do/defer/delegate/delete for saved-state compatibility, but show users **Do / Later / Hand off / Drop**,
- decision=delete means "Drop / do not execute"; it MUST NOT physically delete or clear the node,
- physical clearing/removal must remain a separate explicit action,
- Next Move must normally consider only concrete leaf nodes that are Do, Ready, unfinished, and not suppressed by a non-Do ancestor,
- blocked work remains visible but does not compete for Next Move,
- do not expose Important/Urgent or Delegatable as permanent metadata unless user testing clearly requires them,
- dependencies should stay lightweight; do not recreate Jira,
- use progressive disclosure: Hand off reveals a target; Later reveals a date,
- the Table view is the primary decision surface,
- the Map view should show only compact decision/readiness cues and remain visually playful,
- scoring is a sorting aid; never present fake precision as truth,
- Review should help users revise or delete work when reality changes,
- progress must not punish users for intentionally deleting work from the execution plan.


## Flow and ritual design language

The product should feel light, fluid, and quietly ritualistic without losing its game energy.

Design rules:

- use generous empty space and calm natural palettes,
- prefer jade / teal / sky / warm gold / coral over loud dashboard status colors,
- flowing curves and ripple-like feedback are welcome,
- keep the opening state meditative and almost empty,
- preserve completion dopamine: checkmarks, bounded confetti, progress movement, and celebration are intentional,
- completion may combine a quick celebratory spark with a softer ripple/settle effect,
- philosophical microcopy must be short and optional, never preachy,
- do not add fake cultural decoration (kanji, bamboo, lanterns, cherry blossoms, temple imagery, faux calligraphy),
- express the influence through rhythm, balance, space, flow, and practice rather than stereotypes,
- reduced-motion preferences must disable new ambient/ripple animations.


## Map navigation invariants

- Arrow-key navigation is spatial: choose visible nodes by their rendered positions, not array/tree order.
- With no selected node, use the viewport center as the directional-navigation origin.
- Shift + Arrow pans without changing node selection.
- Clicking empty canvas may clear selection.
- Any direct user camera input must cancel an in-progress camera animation; never let focus animation and user drag compete.
- High-frequency pointer camera updates should be requestAnimationFrame-coalesced.
- Pinch zoom should keep the world point beneath the gesture midpoint stable.
- Node drag thresholds must be measured in screen pixels so low zoom levels do not make nodes accidentally jump.


## 9×9 Grid invariants

- The Grid is exactly 9×9 / 81 cells.
- Root goal is always at row 5, column 5 visually (zero-based 4,4).
- The center 3×3 contains the eight root Drivers around the Goal.
- Driver ordering must match Map's clockwise order: N, NE, E, SE, S, SW, W, NW.
- Each Driver owns the corresponding outer 3×3 block and is repeated at that block's center.
- The Driver's first eight children occupy that block's surrounding eight cells in the same directional order.
- Empty action slots may create the Driver's eight action nodes on demand.
- Do not force deeper recursive Steps into the fixed matrix; show a small descendant count and use Map/Table for deeper structure.
- Grid, Map, and Table must all read/write the same node objects. Never create a separate Grid data model.
- Keep the current calm/playful visual language; the reference image is structural inspiration only.

- Grid view must be hidden below 1024px viewport width; if the viewport shrinks while Grid is active, fall back to Map.


## Palette invariants

- Keep the initial palette set curated: Light, Dark, Sage, Dawn.
- Palette choice is persisted in the existing theme storage key for backward compatibility with prior light/dark users.
- Dark must continue using the existing `body.dark` class because legacy CSS depends on it.
- New palettes should primarily change background/surface variables and mood, not break node/status semantics.
- Any new palette must maintain readable contrast in Map, Table, Grid, Inspector, modals, and mobile controls.
- Do not turn this into an arbitrary color picker until user demand justifies it.


## Local storage invariants

- Planner maps live in IndexedDB, not localStorage.
- Use the locally vendored `idb` wrapper; never add a runtime CDN for it.
- Keep the storage layer in `storage.js`; UI code should call `MandalaStorage` rather than raw IndexedDB.
- The app must migrate the previous single-map localStorage state on first successful IndexedDB initialization.
- Multiple maps must never overwrite one another.
- Starting a new map is non-destructive; the previous map remains in the Maps library.
- Current map writes are debounced.
- Autosave snapshots are deduplicated, bounded, and rate-limited; do not snapshot every keystroke.
- Keep at most 30 snapshots per map unless product requirements change.
- Restoring a version must preserve the current version first.
- Theme/palette preferences may remain in localStorage.
- IndexedDB failure may fall back to legacy single-map localStorage, but the app must say that multi-map storage is unavailable.


## Cross-map structure invariants

- Every map is independent by default. Never require a group or relationship.
- Group names are loose organizational metadata on map records. A group does not imply order, hierarchy, or execution dependency.
- Cross-map links live in the IndexedDB `mapLinks` store.
- Supported canonical link types are:
  - `related` — symmetric association,
  - `before` — directional sequence from earlier map to later map,
  - `parent` — directional hierarchy from parent map to child map.
- UI labels may expose reverse language such as After and Child of, but persistence should normalize those to `before` and `parent`.
- A map may have many Related links and many sequence links.
- A map may have at most one direct Parent in the initial model.
- Parent links and Before links must remain acyclic.
- Deleting a map must delete every cross-map link that references it.
- Autosave/restore of a map's internal state must not erase its group metadata or map-level relationships.
- Do not copy map-level links into node state. The inner Mandala tree and outer map graph are separate layers.
