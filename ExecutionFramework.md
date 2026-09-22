# Mandala Execution Framework

## Purpose

Mandala should keep the useful reasoning from several planning methods without forcing the user to learn or maintain all of them.

The visible product model is intentionally small:

**Break it down → Decide → Do next → Review**

That is the UX.

The deeper principles stay under the hood.

---

## 1. Break it down

Start with one goal.

Use the Mandala structure to expose major drivers, then turn those drivers into concrete actions.

Borrow the useful parts of:

- Mandala 8×8,
- Divide and Conquer,
- Work Breakdown Structure,
- outcome → controllable-action conversion,
- actionability checks,
- Definition of Done.

These are not separate UI modes.

They are quality rules for decomposition.

Stop splitting when the next physical or digital action is obvious.

Bad:

> Get 100 customers.

Better:

> Contact 10 qualified prospects with a concrete paid offer.

---

## 2. Decide

The map is a possibility space, not a command to complete everything.

Give each meaningful action one simple decision:

- **Do** — keep it in the active plan.
- **Later** — keep it, but remove it from the current queue.
- **Hand off** — it should happen, but not necessarily by the user.
- **Drop** — decide not to execute it.

These labels preserve the useful soul of the 4Ds without making the interface sound like a productivity seminar.

**Drop is a decision, not destructive deletion.** The node stays visible. Clearing the node is a separate action.

Use only a few supporting signals:

- **Impact**
- **Effort**
- **Blocked by**
- **Estimate**
- **Status**

Impact/Effort is a sorting aid, not a score of truth.

A blocker should be lightweight: Ready, or blocked by another node.

### Principles that stay behind the scenes

Eisenhower-style importance/urgency, delegatability, prioritization heuristics, and similar concepts can inform product logic and future AI critique.

They should not become permanent fields unless repeated real usage proves that users need them.

The rule is:

> **Keep the intelligence. Remove the methodology tax.**

---

## 3. Do next

Next Move exists to reduce the whole map to one executable action.

A node is normally eligible only when it is:

- a concrete leaf,
- unfinished,
- set to **Do**,
- Ready,
- not beneath a parent set to Later, Hand off, or Drop.

Among eligible actions, use simple signals such as:

- Impact,
- Effort,
- current status,
- duration.

Do not pretend the ranking is objective.

The result should be understandable without exposing a scoring formula.

---

## 4. Review

Plans are hypotheses.

After execution, ask:

1. What actually moved the goal?
2. What turned out to be unnecessary?
3. What is blocked?
4. What changed?
5. What is the next bottleneck?

Then change the map.

This preserves the useful parts of feedback loops and review triggers without creating another workflow users have to manage.

---

## Product views

The same inner map state can be seen through three synchronized views.

### Map

The Map is for spatial thinking, recursive decomposition, context, movement, and execution.

Decision indicators should stay small and playful. Arrow keys move spatially between visible nodes; Shift+Arrow pans. Manual pan/pinch/wheel input should cancel camera focus animation rather than fight it.

### Table

The Table is for scanning and changing:

- Decision,
- Impact,
- Effort,
- Ready / Blocked,
- Status.

Driver rows can expand and collapse.

Do not add methodology columns merely because the underlying philosophy knows about them.

### Grid

The Grid is the classic fixed-depth 9×9 Mandala view:

- Goal in the exact center,
- eight Drivers around it,
- one outer 3×3 block per Driver,
- eight Actions around the repeated Driver.

Grid is an overview grammar, not the recursive source of truth. Deeper Steps stay in Map/Table. The Grid is hidden below 1024px because shrinking 81 cells onto a phone hurts clarity.

### Inspector

The Inspector contains deeper details only when needed:

- Decision,
- Impact,
- Effort,
- Blocked by,
- Hand off to — shown only for Hand off,
- Bring back on — shown only for Later,
- Estimate,
- Status,
- Notes.

This is progressive disclosure: only ask for information relevant to the decision the user made.

### Maps library

The Maps library is the outer structural layer. It is not another task-management dashboard.

A map may remain independent, or optionally use:

- **Group** — loose organization,
- **Related** — horizontal association,
- **Before / After** — directional sequence,
- **Parent / Child** — vertical hierarchy.

Group membership does not imply sequence or hierarchy. Before/After and Parent/Child must remain acyclic. In the initial model, a map has at most one direct parent.

---

## 5. Scale across maps

Do not force every meaningful goal into one enormous tree.

One Mandala map is one goal system:

> Goal → Drivers → Actions → Steps

When several goal systems matter together, connect the maps rather than turning one into a giant branch:

> independent maps → optional Group / Related / Sequence / Hierarchy

Examples:

- **Earn $10k/month** may be the parent of separate product-launch maps.
- **Build landing page** may come before **Launch campaign**.
- **Clean computer files** may remain unrelated.

Cross-map structure exists to preserve clarity at a larger scale. It should not become a portfolio-management bureaucracy.

## Progress

Progress should reflect active work.

Later, Hand off, and Drop should not make the user feel that an intentionally narrowed plan is permanently incomplete.

Reward useful execution, not completion theater.

---

## Persistence and recovery

Execution only works if the user's structure is safe enough to return to.

The current local-first model uses IndexedDB for:

- multiple maps,
- the active-map record,
- bounded autosave snapshots,
- cross-map links.

Snapshots preserve inner map state. Map Groups and cross-map relationships live outside the snapshot so restoring an old version does not silently rewrite the user's larger structure.

Starting a new map is non-destructive. Restore should preserve the current version first.

## Design test

Whenever a new planning concept is proposed, ask:

> Does exposing this concept make the next useful action clearer?

If yes, expose the smallest possible control.

If no, keep the idea inside the reasoning layer or remove it.

Mandala should feel like a simple game about getting unstuck, not Jira wearing colorful clothes.
