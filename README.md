# Mandala

**Mandala is a local-first visual tool for breaking a goal down, deciding what matters, and doing the next useful thing.**

The product starts with one goal in the center, expands into the major drivers required to reach it, and lets each driver branch into actionable tasks and smaller steps while the whole structure remains visible on a zoomable canvas.

> **Break it down → Decide → Do next → Review**

Mandala is not trying to be another generic to-do list. The core problem is the gap between **knowing what you want** and **knowing what to do next**.

**Try the beta:** https://mandala-chart.yorulmazyln.workers.dev — no account, nothing to install; maps stay in your browser.

![Space view: the goal as a sun, drivers as planets, actions as moons](docs/space-planet.jpg)

> **Beta.** Things may still break. Use **Save** to keep a backup of maps you care about, and **Feedback** in the top bar to report bugs or ideas ([GitHub Issues](https://github.com/ylnyorulmaz/mandala-chart/issues/new/choose)).

---

## Current prototype

The current version is a front-end-only PWA built with HTML, CSS, JavaScript, and jQuery.

It supports:

- one central goal,
- eight driver nodes,
- recursive actions and smaller steps,
- switchable Map, Table, and classic 9×9 Grid views,
- a 3D **Space** view where the goal is a sun, drivers are planets and actions are moons — explorable, editable, and in sync with the planner,
- map backup and restore: **Save** downloads a JSON file, **Import map** (in Maps) brings it back as a new map,
- responsive mobile touch layout with safe-area support,
- phone-friendly table cards instead of forced desktop-width scrolling,
- simple decisions: Do / Later / Hand off / Drop,
- dependency-aware Ready / Blocked state,
- Impact / Effort guidance,
- smarter Next Move selection from ready Do actions,
- lightweight Review loop,
- persistent mind-map canvas,
- pan and zoom,
- spatial arrow-key navigation,
- Shift + arrow keyboard panning,
- cancellable camera motion so manual dragging never fights an old focus animation,
- fit-to-map,
- smooth camera focus,
- branch expansion/collapse,
- SVG connections,
- inline editing,
- manual node repositioning,
- minimap navigation,
- impact / effort metadata,
- duration, status, and notes,
- local demo suggestions,
- IndexedDB persistence via locally vendored `idb`,
- multiple local maps,
- optional cross-map grouping and relationships,
- related / before-after / parent-child map links,
- autosave version snapshots and restore,
- JSON export,
- PWA installation,
- offline caching,
- four persistent color palettes: Light, Dark, Sage, and Dawn,
- a calm opening prompt whose italic action verb rotates through **achieve / do / finish**,
- a slow breathing starter pulse instead of a rotating orbit.

## Interaction model

1. Enter one central goal.
2. Eight driver nodes animate outward.
3. Switch between Map, Table, and classic 9×9 Grid views at any time.
4. Pan and zoom while keeping the whole map available.
5. Click a node to focus the camera on that branch, or use the arrow keys to hop spatially between visible nodes.
6. Expand a driver into executable actions.
7. Split an action again only if it is still too broad.
8. Collapse branches when the map becomes noisy.
9. Decide: **Do / Later / Hand off / Drop**.
10. Add Impact / Effort or a blocker only when they help.
11. Use **Next move** to surface a ready action.
12. Review and revise the map as reality changes.

The design principle is:

> **Overview first, focus second.**

---

## Product principles

Mandala borrows useful ideas from Mandala planning, divide-and-conquer, WBS, controllable-action thinking, Definition of Done, Impact/Effort, Eisenhower-style prioritization, the 4Ds, dependencies, and feedback loops.

Those ideas belong **under the hood**. The user should not have to operate a pile of productivity frameworks.

The visible interaction is deliberately simpler:

1. **Break it down.**
2. **Decide.**
3. **Do next.**
4. **Review.**

See [Product.md](Product.md) for the full product vision and philosophy.

---

## Documentation

- [Product.md](Product.md) — product vision, philosophy, audience, capabilities, constraints, limitations, and business hypothesis.
- [ProductRoadmap.md](ProductRoadmap.md) — staged roadmap from prototype hardening through dogfooding, AI assistance, optional cloud sync, and validation.
- [ExecutionFramework.md](ExecutionFramework.md) — the product's decomposition, decision, next-move, review, and cross-map reasoning model.
- [Agents.md](Agents.md) — rules and constraints for coding agents working in the repository.
- [Cloudy.md](Cloudy.md) — coding-assistant guide focused on the product architecture and interaction model.
- [about.html](about.html) — public-facing explanation of the product and method.
- [blog.html](blog.html) — Mandala essays and case studies; the first post tells the Shohei Ohtani goal-chart story in detail.

---

## AI status

The current **Suggest** interaction uses lightweight local demo suggestions.

There is currently:

- no external model call,
- no OpenRouter integration,
- no Gemini integration,
- no Groq integration,
- no API key requirement.

A later version may support provider-neutral AI assistance or BYOK.

The intended AI role is to:

- suggest missing drivers,
- identify overlap,
- rewrite vague nodes,
- convert outcomes into controllable actions,
- split oversized actions,
- critique weak plans.

AI should assist the plan, not silently replace it.

---

## Stack

- HTML
- CSS
- JavaScript
- jQuery 3.7.1
- SVG
- IndexedDB
- `idb` 6.1.5 (vendored locally)
- Three.js 0.180.0, pmndrs `postprocessing` 6.39.6 and GSAP 3.13.0 for the 3D Space view (vendored locally, loaded only by `space.html`)
- localStorage for lightweight preferences / migration fallback
- Service Worker
- Web App Manifest

jQuery is vendored locally.

**No runtime CDN dependencies.**

There is currently no build step and no backend.

---

## Run locally

Serve the repository over HTTP so the service worker can register.

Example:

    python3 -m http.server 8080

Then open:

    http://localhost:8080

---

## Deploy (Cloudflare)

Mandala has no backend, so it is deployed as a static site with Cloudflare **Workers Static Assets**:

    npx wrangler deploy

- `wrangler.jsonc` serves this folder as-is (`html_handling: "none"` keeps `/space.html` and the other paths exactly as `sw.js` caches them),
- `.assetsignore` keeps the Markdown docs and config out of the published site,
- `_headers` makes the browser revalidate `sw.js` so service-worker updates arrive immediately.

Live: https://mandala-chart.yorulmazyln.workers.dev

Maps live in each browser's IndexedDB, per origin, so a new domain starts with an empty library. Use **Save** to export a map and bring it over.

---

## Data

Mandala is local-first.

Planner data is stored in browser **IndexedDB** using the locally vendored `idb` wrapper.

Database:

    mandala-local

Stores:

- `maps` — multiple complete Mandala maps,
- `snapshots` — autosaved map versions,
- `meta` — active-map metadata,
- `mapLinks` — optional relationships between otherwise independent maps.

The current IndexedDB schema is version **2**. Map-level grouping is stored on each map record; cross-map relationships live separately in `mapLinks`, so restoring an internal map snapshot does not rewrite the outer map structure.

Autosave behavior:

- the live map record is saved shortly after edits,
- a version snapshot is created after the editing burst settles,
- snapshots are deduplicated,
- snapshot creation is rate-limited to roughly one every 30 seconds during continuous work,
- the newest **30 versions per map** are retained,
- switching maps / starting a new map preserves the map being left,
- version restore saves the current version before restoration.

Existing single-map `localStorage` data is migrated into IndexedDB on first successful database initialization.

Theme/palette preferences remain in `localStorage`.

Use the export control to download the current map as JSON.

Important: this remains **device-local** storage. There is no cloud backup or cross-device sync yet.

---

## Current limitations

The current iteration intentionally excludes:

- accounts,
- cloud sync,
- live LLM calls,
- payments,
- team collaboration,
- native mobile apps,
- calendar integrations,
- advanced dependency management,

Mandala should prove repeated usefulness before becoming a larger SaaS.

---

## Development rules

The repository intentionally stays lightweight.

Do not introduce:

- runtime CDN dependencies,
- framework rewrites,
- a backend,
- mandatory accounts,
- heavy build tooling,

without a concrete product reason.

For detailed contributor rules, read [Agents.md](Agents.md).

---

## Validation goal

The current prototype should be dogfooded on real work.

The main acceptance question is not:

> “Does the map look cool?”

It is:

> **“Did using Mandala cause useful actions to happen that would otherwise have been postponed?”**

Repeated use, completed actions, requests for history/sync, and users returning to existing maps are stronger signals than one-time praise.

---

## Feedback

Mandala is in beta. The **Feedback** link (top bar on every page) opens a GitHub issue form with your browser, screen and app version filled in; if something crashes, a small **Report it** notice does the same with the error attached. Map contents are never included.

The app version lives in `feedback.js` (`APP_VERSION`) and matches `CACHE_NAME` in `sw.js` — bump both together.


## License

Mandala is released under the [MIT License](LICENSE).

Third-party libraries in `vendor/` keep their own licenses:

| Library | Version | License |
|---|---|---|
| [jQuery](https://jquery.com) | 3.7.1 | MIT — `vendor/jquery-LICENSE.txt` |
| [idb](https://github.com/jakearchibald/idb) | 6.1.5 | ISC — `vendor/idb-LICENSE.txt` |
| [three.js](https://threejs.org) | 0.180.0 | MIT — `vendor/three/LICENSE.txt` |
| [postprocessing](https://github.com/pmndrs/postprocessing) | 6.39.6 | Zlib — `vendor/postprocessing/LICENSE.txt` |
| [GSAP](https://gsap.com) | 3.13.0 | GSAP Standard "No Charge" License — `vendor/gsap/LICENSE.txt` |


## Execution framework

The current product philosophy is documented in [ExecutionFramework.md](ExecutionFramework.md):

**Break it down → Decide → Do next → Review**

The central rule is: **keep the intelligence; remove the methodology tax from the UX.**


## Mobile behavior

The planner is designed to remain usable on phones rather than merely shrink the desktop layout:

- primary touch targets are at least about 44px,
- the action toolbar becomes a horizontal thumb dock,
- Map/Table controls and zoom controls avoid overlapping,
- the Inspector and modals become bottom sheets,
- Table rows become readable cards on narrow screens,
- iPhone safe areas / home indicator spacing are respected,
- the goal starter scales by both viewport width and height,
- the map can zoom farther out on narrow screens so larger trees can fit,
- orientation changes re-center the active node.

Actual device QA is still required before claiming full cross-device coverage.


### Map navigation

Keyboard and pointer navigation are designed to cooperate:

- **Arrow keys** jump to the nearest visible node in that direction.
- If no node is selected, arrow navigation starts from the current viewport center.
- **Shift + Arrow** pans the canvas without changing selection.
- Clicking empty canvas clears the active node; the next arrow key starts spatial navigation from what is currently on screen.
- Manual drag, pinch, wheel, or node drag cancels any in-progress camera focus animation, so the camera does not fight the user.
- Pointer movement is coalesced through animation frames for smoother canvas panning.


### 9×9 Grid view

The third view is a classic Mandala / Mandalart matrix. **Grid view is available only on screens 1024px wide or larger**, so phones do not get a cramped 9×9 experience:

- exactly **9×9 cells**,
- the goal sits in the exact center,
- the eight drivers surround the goal in the middle 3×3,
- each driver is repeated at the center of its own outer 3×3 block,
- that block's eight surrounding cells show the driver's eight actions,
- action cells stay synchronized with Map and Table state,
- empty action cells can be tapped/clicked to create that action branch,
- deeper descendants are represented with a small count instead of trying to force recursive steps into the fixed 9×9 matrix.

The Grid view is a structured overview, not a replacement for the recursive Map view. It is deliberately hidden below **1024px**; phones and narrow tablets use Map and Table only.


### Space view (3D)

`space.html` renders the active map as a solar system you can fly around:

- the **goal is the sun** at the center,
- each **driver is a planet** on its own orbit, with a procedurally generated surface (gas giant, terra, ice, rock),
- **actions are moons** circling their planet, **steps are moonlets** circling their moon,
- empty slots appear as faint wireframe "unformed" bodies,
- cleared (done) nodes get a glowing golden ring; nodes marked *Doing* pulse.

Decisions are visible too, using the same rules as the planner:

- **Later** bodies are faded, **Drop** bodies are grey ghosts, **Hand off** bodies get a small blue courier, and anything under a parked parent is dimmed,
- a node that is **blocked** by another gets a dashed red line to its blocker and a "Blocked" tag,
- the planner's **Next move** (same filter and score as the 2D modal) carries a pulsing cyan beacon; **Next ✦** or `N` flies there.

Interaction:

- drag to rotate, scroll / pinch to zoom, right-drag / two-finger drag to pan; grabbing the camera during a flight cancels the flight,
- click a planet, moon, label, search result, or list item to fly there; the camera then follows it along its orbit while time slows down,
- the side panel shows path, progress (same numbers as the 2D quest progress), impact / effort / decision, blocker (clickable), notes, and child bodies, plus an **Open / Doing / Done** switch that saves to IndexedDB,
- **edit in space**: rename a body (pencil, double-click the title, or `E`), name an empty slot to turn the wireframe ghost into a real planet or moon, change impact / effort / decision / hand-off / bring-back date / estimate / blocker / notes under **Edit details**, add a branch of eight empty slots (**+ Branch** or `B`), and **Clear node** (two-step confirm),
- `/` searches node titles, **Esc** goes up a level, **← / →** hop between siblings, **↑ / ↓** go to the parent / first child, **Space** pauses orbits, **L** toggles labels, **D** toggles done,
- labels are placed by priority and hidden when they would overlap.

Working with the planner:

- **Space ✦** in the view switcher saves the map and opens Space on the selected node (`space.html?map=…&node=…`); **2D map** in Space opens the planner on the focused node (`index.html?node=…`),
- an open planner tab and Space stay in sync through a `BroadcastChannel` (`mandala-sync`): every Space edit is sent as an op from `map-ops.js` that the planner applies to its own state (so nothing is overwritten), and planner saves update or rebuild the system live,
- the map picker switches between saved maps and sets the active map for the planner.

Performance: planet textures are painted in small time slices after the first frame, phones and low-core devices use a lower pixel ratio and no MSAA, and the pixel ratio steps down automatically when the frame rate stays under ~40 fps. `prefers-reduced-motion` shortens flights, stops auto-rotation, and turns off chromatic aberration. Without WebGL 2 the page links back to the planner.

Code: `space.js` (scene and interaction), `space/model.js` (progress / decision / next-move rules mirrored from `app.js` — change both together), `space/textures.js`, `space/shaders.js`. The 3D libraries are cached by the service worker on first use rather than at install.

Dragging nodes, collapsing branches, suggestions, and map groups / relationships stay in the 2D planner.


### Color palettes

The old binary dark/light toggle is now a small palette picker with four persistent choices:

- **Light** — the default warm paper look,
- **Dark** — the existing night theme,
- **Sage** — a soft green, calmer background,
- **Dawn** — a warm peach / coral background.

The chosen palette is stored locally and applies across the planner and About page.


### Map groups and relationships

A Mandala map is still independent by default. Users can optionally create structure *between* maps when that helps.

The Maps library supports:

- a lightweight **Group** name, such as `$10k/month`, `Home`, or `Project 207`,
- **Related to** for horizontal association without hierarchy,
- **Comes before / Comes after** for directional sequence,
- **Parent of / Child of** for vertical hierarchy.

Examples:

- `Earn $10k/month` can be the parent of separate ResumeBee, CarouselBee, and other product-launch maps.
- `Build landing page` can come before `Launch campaign`.
- `Clean computer files` can remain completely unrelated to both.

Groups are organizational labels, not hierarchy. Parent/child and before/after relationships are stored separately. The app blocks circular parent hierarchies and circular sequences.


### Two scales of structure

Mandala now has two intentionally separate structural layers:

**Inside one map**

> Goal → Drivers → Actions → Steps

**Between maps**

> Independent goals → optional Group / Related / Before-After / Parent-Child relationships

A map should stay independent when that is the clearest model. Cross-map structure is optional and should prevent giant artificial Mandalas rather than create portfolio bureaucracy.

The first outer-graph model keeps:

- **Group** as a loose label only,
- **Related** as symmetric association,
- **Before / After** as an acyclic sequence,
- **Parent / Child** as an acyclic hierarchy with one direct parent per map.

There is not yet a separate zoomable "map of maps" canvas; the current outer graph is managed from the Maps library.
