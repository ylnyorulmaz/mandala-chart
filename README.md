# Mandala

A local-first visual goal decomposition prototype.

Mandala turns a fuzzy intention into a navigable execution tree:

**Goal → drivers → actions → next action**

The first iteration is deliberately front-end only. It uses HTML, CSS, JavaScript and jQuery, stores the map in localStorage, and can be installed as a PWA.

## Current interaction

1. Enter one central goal.
2. Eight driver nodes animate outward on a persistent mind-map canvas.
3. Pan the canvas, scroll or pinch to zoom, and use **Fit** to see the entire map.
4. Click a node to smoothly center the camera on it; double-click to edit it.
5. Opening a driver reveals eight action nodes while the rest of the map remains visible.
6. Split any action again when it is still too broad; collapse branches when you need less visual noise.
7. Add impact, effort, urgency, duration, status and notes in the details inspector.
8. Use **Next action** to surface a high-leverage unfinished leaf action.
9. Shift-drag nodes for manual repositioning and use the minimap for fast navigation.
10. Export the full map as JSON.

## Planning ideas embedded in the UI

- Mandala-style decomposition
- Divide and conquer
- Impact / effort prioritization
- Urgency-aware triage
- Concrete next actions
- Recursive decomposition only when it reduces execution friction

The app does **not** require users to learn those frameworks. They are implementation principles behind the interface.

## AI status

The **Suggest** interaction is wired as a front-end demo with lightweight local suggestion sets. No external model or API key is used in v1.

A later iteration can replace the suggestion generator with OpenRouter, Gemini, Groq, or BYOK while keeping the same UI contract.

## Stack

- HTML
- CSS
- JavaScript
- jQuery 3.7.1 (vendored locally; no runtime CDN dependency)
- localStorage
- Service Worker + Web App Manifest

No build step is required. Runtime assets are local; the app does not depend on a CDN.

## Run locally

Serve the directory over HTTP so the service worker can register.

Example:

    python3 -m http.server 8080

Then open:

    http://localhost:8080

## Keyboard

- \`Esc\` — close details / modal
- \`Ctrl/Cmd + K\` — open Next Action mode

## Data

Everything is stored locally in the browser under:

    mandala-chart-state-v1

Use the export button in the top bar to download the current map as JSON.

## v1 boundary

This iteration intentionally excludes:

- accounts
- cloud sync
- real LLM calls
- payments
- collaboration
- native mobile apps
- calendar integrations

The current prototype validates the core interaction: **type an outcome → see the whole map → focus a branch → decompose → execute.**
