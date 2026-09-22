# Cloudy

## Role

This is the coding-assistant guide for working on Mandala.

Treat `Product.md` as the source of product intent and `ProductRoadmap.md` as the source of sequencing.

Do not optimize for feature count.

Optimize for a product that helps a user move from an unclear goal to an obvious next action.

---

## What Mandala is

Mandala is a local-first zoomable mind-map for execution.

Its core structure is:

**Goal → Drivers → Actions → Steps**

Its core behavior is:

**see the whole map → focus a branch → decompose → prioritize → execute**

It should feel more like navigating a spatial map than filling out a project-management form.

---

## Current architecture

Main files:

- `index.html` — planner shell and canvas UI
- `about.html` — public explanation of the concept
- `styles.css` — visual system and responsive behavior
- `app.js` — state, layout, camera, editing, suggestions, next-action logic
- `manifest.webmanifest` — PWA metadata
- `sw.js` — offline caching
- `vendor/` — locally vendored browser dependencies

No framework.

No backend.

No build step.

---

## Non-negotiable rule: no CDN runtime dependencies

The project previously broke because a CDN/SRI failure prevented jQuery from loading.

Do not reintroduce that failure mode.

If a dependency is needed:

1. vendor it locally,
2. pin the version,
3. load it from the repository,
4. add it to the service-worker cache if required.

---

## Product behavior to preserve

### The canvas is persistent

Do not replace the map with drill-down pages.

### Nodes are spatial

The user should be able to pan, zoom, and understand parent-child relationships.

### Focus is camera movement

Selecting a branch should center or emphasize it without erasing surrounding context.

### Decomposition is recursive

Any action can become the parent of smaller steps if it is still too broad.

### Planning is not the final output

The product should surface executable leaf actions.

---

## UI direction

Preferred qualities:

- warm,
- friendly,
- personal,
- playful without becoming childish,
- spatial,
- readable,
- responsive,
- smooth but not theatrical.

The product should feel closer to a lightweight colorful game, playful mind map, or creative studio wall than a corporate SaaS dashboard. Use vibrant but warm colors, tactile controls, rounded/system game-like typography, smooth transform/opacity animations, visible quest progress, direct check-off controls, and brief confetti celebrations. Keep it fast: prefer CSS transforms and opacity, avoid heavy animation libraries, and remove celebration DOM after each burst.

Avoid:

- giant marketing hero UI inside the working canvas,
- card-dashboard layouts,
- excessive gradients,
- huge glassmorphism layers,
- noisy animations,
- visual clutter.

The map itself is the main interface.

---

## Suggested node hierarchy

### Goal

- strongest visual weight,
- central/root identity,
- immediately recognizable.

### Driver

- medium visual weight,
- clearly connected to Goal,
- distinct from executable tasks.

### Action

- lighter visual weight,
- practical,
- should be easy to scan.

### Step

- smallest visual weight,
- used only when further decomposition is useful.

Exact shapes and colors may evolve.

Do not encode hierarchy through color alone.

---

## Camera rules

Pan/zoom should be implemented as a world transform rather than individually moving every node during camera movement.

Camera behavior should support:

- pan,
- zoom around pointer/touch midpoint,
- fit-to-map,
- focus node,
- return to root,
- minimap navigation.

Keep transforms smooth and avoid re-layout during camera motion.

---

## Layout rules

Automatic layout should prioritize readability over mathematical symmetry.

Good layout:

- keeps siblings grouped,
- gives branches room,
- limits crossings,
- avoids node overlap,
- preserves stable positions when unrelated branches change.

Manual repositioning should not unexpectedly reset after another edit.

---

## Editing rules

Editing a node should be fast.

Prefer:

- inline edit,
- Enter to confirm where appropriate,
- Escape to cancel,
- explicit details inspector for metadata.

Avoid accidental navigation while editing.

Deletion of a parent with children must make subtree impact clear.

---

## Planning metadata

Current useful metadata:

- decision: Do / Later / Hand off / Drop,
- impact,
- effort,
- lightweight dependency,
- duration,
- status,
- notes.

Do not expose Important/Urgent, Delegatable, or other methodology-derived fields by default. Keep those ideas in the reasoning layer unless real usage proves they deserve UI.

Do not add more fields unless they visibly improve prioritization or execution.

---

## Next Action logic

Next Action should choose from executable unfinished leaf nodes.

It should not choose:

- the root goal,
- high-level drivers,
- completed nodes,
- nodes whose meaningful children are still open.

Scoring is a heuristic, not truth.

Keep the reason understandable.

---

## AI roadmap

The first real AI layer should improve node quality rather than add a chatbot.

Useful actions:

- suggest drivers,
- suggest actions,
- rewrite as controllable action,
- split this node,
- find overlap,
- find missing driver,
- critique this plan.

Prefer structured JSON output.

Show proposed changes before applying them.

---

## Before making a substantial change

Read:

- `Product.md`
- `ProductRoadmap.md`
- `Agents.md`
- current implementation files

Then ask:

> Does this improve clarity, decomposition, navigation, prioritization, or execution?

If not, it probably does not belong yet.

---

## Testing checklist

At minimum verify:

- first-run empty state,
- goal creation,
- driver expansion,
- action expansion,
- pan,
- zoom,
- focus node,
- fit map,
- minimap,
- edit,
- collapse/expand,
- manual reposition,
- details inspector,
- next action,
- JSON export,
- persistence after reload,
- mobile viewport,
- no CDN requests.

---

## Product warning

Mandala is itself a productivity project.

Do not let development of Mandala become a sophisticated form of avoiding the work it is supposed to help complete.

Keep changes small, ship them, dogfood them, and let repeated real usage decide the next feature.


### Decision-model invariants

The current visible philosophy is **Break it down → Decide → Do next → Review**.

When changing the planner:

- treat the map as a possibility space rather than a mandatory checklist,
- preserve stable internal decision values while showing **Do / Later / Hand off / Drop** to users,
- never conflate Drop with destructive node deletion,
- do not expose Important/Urgent or Delegatable as permanent UI metadata,
- keep dependency handling lightweight and explainable,
- Next Move should favor only Ready + Do executable leaves,
- a Later / Hand off / Drop decision on a parent suppresses descendants from immediate execution,
- use progressive disclosure for Hand off and Later details,
- keep map indicators small and game-like,
- Review mode should summarize decisions and prompt plan revision after real-world feedback.
