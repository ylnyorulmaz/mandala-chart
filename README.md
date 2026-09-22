# Mandala

**Mandala is a local-first visual tool for breaking a goal down, deciding what matters, and doing the next useful thing.**

The product starts with one goal in the center, expands into the major drivers required to reach it, and lets each driver branch into actionable tasks and smaller steps while the whole structure remains visible on a zoomable canvas.

> **Break it down → Decide → Do next → Review**

Mandala is not trying to be another generic to-do list. The core problem is the gap between **knowing what you want** and **knowing what to do next**.

---

## Current prototype

The current version is a front-end-only PWA built with HTML, CSS, JavaScript, and jQuery.

It supports:

- one central goal,
- eight driver nodes,
- recursive actions and smaller steps,
- switchable Map, Table, and classic 9×9 Grid views,
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
- localStorage persistence,
- JSON export,
- PWA installation,
- offline caching,
- dark/light themes.

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
- [Agents.md](Agents.md) — rules and constraints for coding agents working in the repository.
- [Cloudy.md](Cloudy.md) — coding-assistant guide focused on the product architecture and interaction model.
- [about.html](about.html) — public-facing explanation of the product and method.

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
- localStorage
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

## Data

The current prototype stores its map locally in the browser.

Primary local storage key:

    mandala-chart-state-v1

Use the export control to download the current map as JSON.

Important: the current prototype does not yet provide cloud backup or cross-device sync.

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
- sophisticated history/versioning.

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

## License

No explicit open-source license has been added yet. Until one exists, the repository is publicly visible but reuse rights are not automatically granted.


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

The Grid view is a structured overview, not a replacement for the recursive Map view.
