# Product Roadmap

## Purpose

This roadmap defines the next steps for Mandala as a small product experiment.

The priority is not feature volume. The priority is proving that decomposition + triage + next-action selection changes real user behavior.

The sequence is:

**stabilize → break down → decide → do next → review → dogfood → validate → add real assistance → add persistence/sync only when demanded**

---

# Phase 0 — Current prototype

## Status

In progress / functional prototype.

## Current foundation

- local-first PWA,
- responsive mobile bottom action dock,
- mobile bottom-sheet Inspector/modals,
- phone card layout for Table view,
- safe-area-aware iPhone/PWA spacing,
- HTML/CSS/JavaScript/jQuery,
- no runtime CDN dependencies,
- one central goal,
- eight driver nodes,
- recursive actions,
- persistent visual map,
- pan and zoom,
- camera focus,
- minimap,
- branch collapse,
- inline editing,
- node repositioning,
- simple Do / Later / Hand off / Drop decisions,
- impact / effort metadata,
- dependency-aware Ready / Blocked state,
- decision table,
- classic 9×9 Mandala Grid view on 1024px+ screens,
- synchronized Grid selection and action creation,
- spatial arrow-key node navigation and Shift+Arrow panning,
- smoother cancellable pan/pinch/focus camera behavior,
- four curated palettes: Light, Dark, Sage, Dawn,
- Next Move restricted to ready Do actions,
- Review mode and triage summary,
- IndexedDB via locally vendored `idb`,
- multiple local maps,
- autosave snapshots + restore,
- optional map Groups,
- Related / Before-After / Parent-Child cross-map links,
- cycle protection for hierarchy and sequence,
- JSON export,
- local demo suggestions.

## Immediate rule

Do not add large platform features before the core canvas is comfortable enough to use for real work.

---

# Phase 1 — Make the canvas genuinely usable

## Goal

Reach a version that can be used every day without fighting the interface.

## Priority work

### 1. Visual map quality

- improve automatic branch layout,
- reduce node collisions,
- improve connector routing,
- preserve readable spacing as the tree grows,
- distinguish Goal / Driver / Action / Step visually,
- keep overview readable at low zoom,
- add smooth camera transitions,
- improve selected/focused-node state,
- make expansion animations subtle and fast.

### 2. Navigation

- reliable pan with mouse/touch,
- wheel/pinch zoom,
- fit-to-map,
- focus selected node,
- jump to root,
- minimap interaction,
- keyboard navigation where useful.

### 3. Editing

- clear single-click / double-click behavior,
- inline edit without accidental camera movement,
- add/remove child,
- collapse/expand branch,
- reorder or reposition nodes,
- reliable node deletion with subtree warning.

### 4. Mobile and PWA

- verify iPhone Safari interaction,
- verify Android Chrome interaction,
- ensure touch panning does not fight page scrolling,
- ensure pinch zoom behaves predictably,
- verify safe-area layout on physical iPhones and installed PWA mode,
- verify installation and offline load.

### 5. State safety

- verify IndexedDB migration and recovery,
- verify multi-map autosave reliably,
- add import from exported JSON,
- add explicit backup/export,
- consider lightweight undo/redo.

## Exit criteria

Phase 1 is done when a real project with at least:

- 1 goal,
- 6+ drivers,
- 25+ actions,

can be planned and navigated comfortably on desktop and mobile.

---

## Simplicity gate

Before adding more planning features, validate the central behavioral claim:

> A broad decomposition is useful only if the product makes the next decision simpler, not more bureaucratic.

Dogfood must therefore test the visible loop:

**Break it down → Decide → Do next → Review**

---

# Phase 2 — Dogfood with real outcomes

## Goal

Prove that Mandala creates execution rather than planning theater.

## Required dogfood test

Use Mandala for one real commercial goal, for example:

> Get the first real paying customer for an existing small product.

Use the map for the full loop:

- product readiness,
- offer,
- ICP,
- prospecting,
- outreach,
- distribution,
- payment,
- measurement.

## Track

For one week, record:

- number of sessions,
- number of nodes created,
- number of actions completed,
- number of times Next Move was used,
- number of times the map was revised,
- actions that would likely have been postponed without the map,
- places where the interface caused friction.

## Core question

> Did Mandala make real work easier to start and finish?

If the answer is no, do not hide the failure under more features.

Fix the execution loop first.

---

# Phase 3 — Strengthen decision and next-move intelligence

## Goal

Make the product useful after the map becomes large.

## Improvements

### Better executable-leaf detection

Detect whether a node is:

- an outcome,
- a driver,
- an action,
- too broad,
- blocked,
- already decomposed,
- completed.

### Better prioritization

Use:

- decision state,
- dependency state,
- impact,
- effort,
- duration,
- completion state.

Only **Do + Ready** leaves should normally enter the Next Move queue. Later, Hand off, Drop, blocked, and ancestor-suppressed work should remain visible without competing for immediate attention.

A lightweight score may sort eligible DO actions, but it must not be treated as objective truth.

### Focus mode

Create a deliberately simple execution screen:

- one next action,
- estimated duration,
- parent context,
- mark done,
- skip,
- open map.

### Optional session mode

Potential later experiment:

- choose 15 / 25 / 45 minute session,
- surface one action that fits,
- return to map after completion.

---

# Phase 4 — Real AI planning assistant

## Goal

Replace static suggestions with useful, constrained AI assistance.

## Provider approach

Keep the AI layer provider-neutral.

Candidate providers:

- OpenRouter,
- Gemini,
- Groq,
- user-provided API key.

Prefer inexpensive fast models for interactive suggestions.

## AI capabilities

### Driver assistance

Given a goal:

- suggest missing drivers,
- identify overlapping drivers,
- flag duplicate concepts,
- propose more distinct alternatives.

### Action assistance

Given a driver:

- propose concrete actions,
- convert vague outcomes into controllable behaviors,
- break oversized work into smaller actions,
- suggest definitions of done.

### Plan critique

Across the whole map:

- detect missing areas,
- detect over-planning,
- detect unsupported assumptions,
- detect actions that do not materially support their parent,
- find repeated actions across branches.

### AI behavior rules

The model should:

- suggest, not silently overwrite,
- explain why a suggestion helps,
- prefer specificity,
- avoid generic productivity filler,
- preserve user edits,
- avoid generating dozens of nodes without permission.

## Privacy rule

Never expose a user's API key in client-visible logs or exported maps.

For BYOK, design key handling deliberately before implementation.

---

# Phase 5 — Expand multiple maps and history

## Goal

Build on the now-shipped local multi-map + snapshot foundation and turn it into a stronger reusable personal system.

## Already implemented

- create multiple maps,
- local map library,
- IndexedDB persistence via `idb`,
- bounded autosave snapshots,
- restore earlier versions,
- optional map groups,
- horizontal Related links,
- directional Before/After links,
- vertical Parent/Child links,
- cycle protection for hierarchical and sequential map structure.

## Remaining features

- richer map library,
- optional visual "map of maps" only if the relationship editor proves useful,
- rename/archive maps,
- duplicate map,
- templates,
- recent maps,
- last-opened position/zoom,
- map-level progress,
- import/export,
- undo/redo,
- recovery after accidental deletion.

## Templates worth testing

- ship a product,
- first customer,
- read a book,
- learn a skill,
- job application,
- study for an exam,
- launch content,
- move house,
- personal project.

Templates should start a thought process, not dictate one.

---

# Phase 6 — Optional cloud sync

## Gate

Do not build cloud infrastructure merely because SaaS products usually have accounts.

Build it when users repeatedly ask for:

- laptop ↔ phone sync,
- backup,
- history,
- access from multiple devices.

## Features

- optional account,
- encrypted transport,
- cloud map storage,
- cross-device sync,
- conflict handling,
- backup/recovery.

## Product principle

Local-only mode should remain available.

A user should not lose the core product because they do not want an account.

---

# Phase 7 — Validation with external users

## Goal

Test repeated use, not first impressions.

## Initial test group

5–10 people who visibly experience planning-to-execution friction:

- indie builders,
- creators,
- students,
- knowledge workers,
- people juggling personal projects.

## Observe

Do not over-explain the product.

Watch whether they can:

- create a goal,
- understand drivers,
- navigate the map,
- create actions,
- return later,
- resume work,
- complete something.

## Strong signals

- return usage,
- multiple sessions,
- multiple maps,
- completed actions,
- unsolicited requests for sync/history,
- users saying they finished something they had delayed.

## Weak signals

- compliments,
- likes,
- "cool concept",
- one-time experimentation.

---

# Phase 8 — Monetization experiment

## Gate

Only after repeated usage exists.

## Potential model

### Free

- local-first usage,
- core canvas,
- manual decomposition,
- limited or BYOK AI,
- JSON export.

### Premium

Possible premium features:

- cloud sync,
- full history,
- advanced AI assistance,
- cross-device access,
- richer templates,
- collaboration,
- integrations.

## Avoid

- complex pricing before retention,
- fake feature scarcity,
- making basic local usage unusable,
- paying for infrastructure before user demand exists.

---

# Phase 9 — Integrations, only if behavior justifies them

Possible future integrations:

- calendar,
- reminders,
- task export,
- Notion,
- GitHub issues,
- Google Tasks,
- Todoist,
- Slack,
- email.

These are not core until users prove they need them.

Mandala should first solve decomposition and next-action clarity by itself.

---

# Explicit non-priorities

Do not prioritize these now:

- native iOS app,
- native Android app,
- desktop Electron app,
- team workspaces,
- real-time multiplayer,
- enterprise permissions,
- social features,
- marketplace,
- complex analytics,
- heavy gamification systems such as points economies, streak pressure, and leaderboards,
- AI autonomous execution.

---

# Near-term execution order

1. Browser-test the current Map / Table / Grid interactions on desktop.
2. Physical-device-test phone and tablet behavior, especially pan/pinch, bottom sheets, and safe areas.
3. Test IndexedDB migration, multi-map switching, autosave, restore, Groups, and cross-map links in real browsers.
4. Add JSON import / recovery.
5. Dogfood one real commercial goal and at least one parent goal with multiple child maps.
6. Record friction for seven days and fix repeated friction.
7. Give the tool to 5 external users and measure return usage.
8. Validate whether the outer map graph needs a dedicated visual "map of maps" view before building one.
9. Only then connect a real LLM.
10. Treat cloud sync as optional and demand-driven, not the automatic next step.

---

# Roadmap decision rule

Every proposed feature must answer:

> Does this help the user understand the goal, decompose it, choose a useful next action, or complete work?

If not, postpone it.

Mandala must remain a tool for finishing things, not a project-management hobby disguised as a productivity product.
