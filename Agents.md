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
3. test fresh localStorage,
4. test existing saved state,
5. test desktop,
6. test narrow mobile viewport,
7. test pan/zoom/focus,
8. test editing,
9. test export,
10. test basic offline reload when relevant.

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

**Goal → Drivers → Actions → Triage → Execute → Review → Revise**

Implementation rules:

- preserve the 8×8 structure as a decomposition constraint, not as an instruction to complete everything,
- keep decision as one of do, defer, delegate, or delete,
- decision=delete means "do not execute"; it MUST NOT physically delete or clear the node,
- physical clearing/removal must remain a separate explicit action,
- Next Move must normally consider only concrete leaf nodes that are DO, Ready, unfinished, and not suppressed by a non-DO ancestor,
- blocked work remains visible but does not compete for Next Move,
- use Important/Urgent separately from Impact/Effort,
- dependencies should stay lightweight; do not recreate Jira,
- the Table view is the primary triage surface,
- the Map view should show only compact decision/readiness cues and remain visually playful,
- scoring is a sorting aid; never present fake precision as truth,
- Review should help users revise or delete work when reality changes,
- progress must not punish users for intentionally deleting work from the execution plan.
