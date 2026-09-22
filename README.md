# Mandala

A local-first visual goal decomposition prototype.

Mandala turns a fuzzy intention into a navigable execution tree:

**Goal → drivers → actions → next action**

The first iteration is deliberately front-end only. It uses HTML, CSS, JavaScript and jQuery, stores the map in localStorage, and can be installed as a PWA.

## Current interaction

1. Enter one goal.
2. Eight driver nodes animate around it.
3. Fill the drivers manually or use **Suggest** for local demo suggestions.
4. Click a driver to focus it and reveal eight action slots.
5. Split any broad action again when needed.
6. Add impact, effort, urgency, duration, status and notes.
7. Use **Next** to surface the highest-leverage unfinished leaf action.
8. Export the full map as JSON.

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
- jQuery 3.7.1
- localStorage
- Service Worker + Web App Manifest

No build step is required.

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

The purpose of v1 is to validate the core interaction: **type an outcome → decompose → navigate → execute.**
