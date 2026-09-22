# Product

## Product name

**Mandala**

A local-first visual execution map that turns a vague intention into concrete, controllable next actions.

The product starts from one goal, exposes the major drivers required to reach it, decomposes those drivers into executable actions, and keeps the entire structure visible on a zoomable mind-map canvas.

The product is not primarily a to-do list. It is a **goal decomposition and execution interface**.

---

## Product vision

Most productivity software starts after the user already knows what to do.

Mandala starts earlier.

A user often knows the outcome they want but not the exact sequence of actions that will move them toward it. That gap creates hesitation, context switching, planning loops, and procrastination.

Mandala should make this transition:

> **I want to achieve X**  
> → **These are the things that need to become true**  
> → **These are the actions under my control**  
> → **This is the next useful thing to do**

The long-term vision is a lightweight visual operating system for personal execution: spatial enough to show the whole problem, structured enough to prevent a messy mind map, and opinionated enough to surface a next action.

---

## Product philosophy

### Visual personality

Mandala should feel like a tiny game about getting unstuck, not enterprise productivity software.

The interaction should be obvious enough to play with immediately: colorful nodes, tactile controls, quick movement, visible progress, satisfying completion states, and lightweight celebrations. The game layer must make action feel easier without turning the product into a childish points-and-badges system.

Completion is a first-class interaction: any meaningful node can be checked off directly, progress should visibly move, and a fast confetti/congratulation moment should reward the action without blocking the user.

Mandala should feel like a warm personal thinking space, not enterprise productivity software.

Prefer:

- warm paper-like neutrals,
- friendly coral, butter, sage, sky, and lavender accents,
- rounded and organic geometry,
- soft depth rather than glossy corporate glass,
- editorial warmth in headings,
- human microcopy,
- calm playful motion.

Avoid:

- cold blue SaaS dashboards,
- dense admin-panel chrome,
- excessive uppercase labels,
- sterile enterprise language,
- dark-tech visual clichés,
- decoration that makes the map harder to read.

### 1. Overview first, focus second

The user should be able to see the whole structure at a glance.

Clicking a node should move the camera toward that branch without destroying context. Mandala should feel like navigating a map, not moving through disconnected pages.

### 2. Execution over organization

The product succeeds when it causes useful work to happen.

A beautiful map that does not change behavior is a failure.

Every feature should ultimately improve one of these:

- clarity,
- decomposition,
- prioritization,
- initiation,
- completion,
- learning from results.

### 3. Decompose only until the next move is obvious

Recursive decomposition is useful when a task is too large, vague, or intimidating.

It becomes harmful when the user starts planning trivial steps that do not need planning.

The rule is:

> Break work down until the action has a clear definition of done and low startup friction. Then stop planning and do it.

### 4. Eight is a thinking constraint, not a law of nature

Mandala borrows the classic one-center/eight-around structure because constraints can improve thinking and coverage.

The product must not pretend every real-world goal naturally contains exactly eight meaningful parts.

Where useful, future versions may allow fewer children, free-form decomposition, or AI-proposed counts while preserving Mandala mode.

### 5. Prefer controllable actions over uncontrollable outcomes

"Get 100 customers" is an outcome.

"Contact 10 qualified prospects today" is an action.

The product should help users detect this difference.

### 6. AI is a critic and assistant, not an autopilot

AI should help users:

- discover missing drivers,
- detect overlap,
- rewrite vague nodes,
- flag outcomes outside direct control,
- break oversized actions down,
- suggest concrete next actions,
- critique weak plans.

AI should not silently replace the user's plan or flood the map with generic tasks.

### 7. Local-first by default

The core product should remain useful without:

- an account,
- a subscription,
- an internet connection,
- a cloud backend,
- an AI provider.

Cloud sync and AI can be optional extensions, not prerequisites.

### 8. Fast, small, understandable software

The product should remain lightweight.

Do not turn a small execution tool into a large project-management platform unless real user behavior proves that expansion is necessary.

---

## Core product model

The default structure is:

**Goal → Drivers → Actions → Smaller Steps → Next Action**

### Goal

The single central outcome the user wants to achieve.

Examples:

- Get the first paying customer for a small SaaS.
- Finish a book in three days.
- Learn three songs on ukulele.
- Prepare a portfolio for a job application.
- Organize a move to another apartment.

### Driver

A major area that materially contributes to the goal.

For a product launch, examples could include:

- product readiness,
- offer,
- pricing,
- ideal customer,
- distribution,
- outreach,
- proof,
- measurement.

### Action

A controllable behavior that moves a driver.

Examples:

- test the payment flow,
- identify ten qualified prospects,
- create three proof examples,
- send five personalized messages.

### Smaller step

A further decomposition used only when an action is still too broad.

### Next action

An unfinished executable leaf node selected using practical signals such as:

- impact,
- effort,
- urgency,
- dependency state,
- estimated duration,
- current status.

---

## Target audience

Mandala is intentionally broad at the use-case level but narrow at the behavioral level.

The primary audience is people who frequently know **what they want** but stall on **what to do next**.

### Primary target users

#### Indie builders and solo developers

People shipping:

- SaaS products,
- micro-products,
- websites,
- extensions,
- bots,
- small experiments.

They often have many possible tasks and weak separation between building, launching, distribution, and selling.

#### Creators and knowledge workers

People managing:

- content projects,
- research,
- writing,
- campaigns,
- launches,
- personal projects.

They benefit from spatial decomposition and a visible hierarchy.

#### Students and self-directed learners

People working toward:

- exams,
- reading goals,
- courses,
- skill acquisition,
- portfolio projects.

#### People with planning-to-execution friction

Users who regularly experience:

- "I don't know where to start."
- "This project is too big."
- "My to-do list is useless."
- "I keep reorganizing instead of doing."
- "I have too many things in my head."

---

## Jobs to be done

Users hire Mandala to:

1. turn an unclear goal into a structured plan,
2. see the whole plan without losing hierarchy,
3. identify missing areas,
4. convert outcomes into controllable actions,
5. break intimidating work into smaller steps,
6. decide what deserves attention first,
7. resume work without reconstructing the whole project mentally,
8. surface one useful next action,
9. revise the plan as reality changes.

---

## Core experience

### Empty state

The canvas starts with one central prompt such as:

- What do you want to finish?
- What do you want to achieve?
- What is your goal?
- What needs to get done?

The user enters one goal.

### First expansion

Eight driver nodes animate outward from the central goal.

The user can:

- fill them manually,
- edit them,
- ask for suggestions,
- replace weak or overlapping drivers.

### Map navigation

The whole map remains available on one canvas.

The user can:

- pan,
- zoom,
- fit the map to the viewport,
- click a node to focus the camera,
- expand or collapse branches,
- reposition nodes,
- use a minimap for navigation.

### Decomposition

Opening a driver reveals action nodes.

Actions can be decomposed further when necessary.

### Evaluation

Nodes may carry:

- impact,
- effort,
- urgency,
- duration,
- status,
- notes.

### Execution

A next-action mode surfaces an unfinished executable leaf rather than showing the user the entire tree all the time.

---

## Current capabilities

The current front-end prototype supports:

- one central goal,
- eight driver nodes,
- recursive child/action decomposition,
- persistent zoomable mind-map canvas,
- pan and zoom,
- fit-to-screen,
- camera focus on a selected node,
- branch expansion and collapse,
- SVG connections between nodes,
- inline node editing,
- manual node repositioning,
- minimap navigation,
- node details inspector,
- impact / effort / urgency metadata,
- duration and status,
- notes,
- simple next-action selection,
- local demo suggestions,
- localStorage persistence,
- JSON export,
- PWA installation,
- offline-capable service-worker caching,
- dark/light visual modes,
- locally vendored jQuery,
- no runtime CDN dependency.

---

## Current technical shape

The product is deliberately simple.

### Stack

- HTML
- CSS
- JavaScript
- jQuery 3.7.1
- localStorage
- SVG for graph connections
- Web App Manifest
- Service Worker

### Constraints

- no build step,
- no framework migration without a concrete reason,
- no runtime CDN dependencies,
- no backend in the current iteration,
- no mandatory account.

---

## Current limitations

The prototype is intentionally incomplete.

### Data limitations

- State is browser-local.
- There is no cloud sync.
- There are no accounts.
- There is no automatic cross-device access.
- Export exists, but import/recovery workflows are still limited.
- There is not yet a robust version/history model.

### AI limitations

- Suggestions are currently local/static demo logic.
- No real LLM provider is connected.
- No OpenRouter, Gemini, Groq, or BYOK integration is active.
- No model currently critiques the full plan.

### Planning limitations

- The eight-child structure is currently strong and somewhat rigid.
- Dependency modeling is minimal.
- There is no advanced scheduling engine.
- There is no calendar integration.
- There is no recurring-habit engine.
- There is no sophisticated project portfolio view.

### Collaboration limitations

- No teams.
- No shared maps.
- No comments.
- No permissions.
- No real-time collaboration.

### Product limitations

- This is not a complete project-management system.
- This is not intended to replace Jira, Linear, Notion, Asana, or a calendar.
- This is not a general whiteboard.
- This is not a therapy or medical tool.
- This does not guarantee that completing a plan guarantees the outcome.

The map is a model of the user's current assumptions. It must be revised when reality provides better information.

---

## Non-goals

Mandala should not become, by default:

- a generic infinite whiteboard,
- a clone of Miro,
- a full document editor,
- a CRM,
- a team project-management suite,
- a social network,
- an AI agent platform,
- a massive methodology dashboard.

A feature belongs only if it improves decomposition, prioritization, execution, or useful reflection.

---

## Product differentiation

Mandala sits between several familiar categories:

### Mind maps

Mind maps are good for free exploration but can become unconstrained.

Mandala adds stronger execution structure.

### To-do lists

To-do lists are good after tasks are known.

Mandala helps determine what the tasks should be.

### Project management tools

Project-management tools are powerful but often heavy.

Mandala should remain personal, immediate, and low-friction.

### AI planners

AI planners can generate many tasks quickly.

Mandala should preserve user agency and make the plan spatially understandable instead of dumping a generated checklist.

---

## Success criteria

Near-term success is behavioral, not vanity traffic.

The strongest signals are:

- the creator uses it repeatedly for real work,
- users return to existing maps,
- users complete actions they had previously postponed,
- users ask to preserve history,
- users ask to sync across devices,
- users ask for real AI assistance,
- users create multiple maps,
- users report that a large goal became easier to start.

Weak signals include:

- "cool UI",
- one-time map creation,
- generic social engagement,
- traffic without repeated use.

---

## Initial business hypothesis

Mandala should first prove that it is useful before becoming a commercial SaaS.

A plausible future model is:

### Free / local-first

- local maps,
- core canvas,
- manual decomposition,
- export,
- basic next-action mode.

### Optional premium

Potential paid capabilities, only if users demand them:

- cloud sync,
- cross-device history,
- multiple-device backup,
- richer AI assistance,
- advanced map history,
- templates,
- collaboration,
- integrations.

Do not implement pricing infrastructure before repeated usage validates the product.

---

## Product test

The first real acceptance test is dogfooding.

Use Mandala to execute an actual project with a measurable outcome.

The product earns further development only if it measurably reduces planning friction and causes real actions to happen.

The product should help ship other work, not become an elaborate way to avoid that work.
