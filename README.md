# Mandala

**Mandala is a local-first visual execution map for turning a vague goal into concrete next actions.**

The product starts with one goal in the center, expands into the major drivers required to reach it, and lets each driver branch into actionable tasks and smaller steps while the whole structure remains visible on a zoomable canvas.

> **Goal → Drivers → Actions → Steps → Next Action**

Mandala is not trying to be another generic to-do list. The core problem is the gap between **knowing what you want** and **knowing what to do next**.

---

## Current prototype

The current version is a front-end-only PWA built with HTML, CSS, JavaScript, and jQuery.

It supports:

- one central goal,
- eight driver nodes,
- recursive actions and smaller steps,
- persistent mind-map canvas,
- pan and zoom,
- fit-to-map,
- smooth camera focus,
- branch expansion/collapse,
- SVG connections,
- inline editing,
- manual node repositioning,
- minimap navigation,
- impact / effort / urgency metadata,
- duration, status, and notes,
- simple next-action selection,
- local demo suggestions,
- localStorage persistence,
- JSON export,
- PWA installation,
- offline caching,
- dark/light themes.

## Interaction model

1. Enter one central goal.
2. Eight driver nodes animate outward.
3. Pan and zoom while keeping the whole map available.
4. Click a node to focus the camera on that branch.
5. Expand a driver into executable actions.
6. Split an action again only if it is still too broad.
7. Collapse branches when the map becomes noisy.
8. Add priority metadata where useful.
9. Use **Next action** to surface an unfinished executable leaf.
10. Revise the map as reality changes.

The design principle is:

> **Overview first, focus second.**

---

## Product principles

Mandala combines useful ideas from:

- Mandala-style goal decomposition,
- divide and conquer,
- impact / effort prioritization,
- urgency-aware triage,
- next-action thinking,
- recursive decomposition.

The user should not need to learn productivity jargon. The interface should simply help answer:

1. What am I trying to achieve?
2. What has to happen for that to become possible?
3. What can I actually do?
4. What should I do next?

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
