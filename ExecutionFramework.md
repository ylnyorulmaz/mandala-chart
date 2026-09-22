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

### Map

The Map is for thinking spatially, decomposing, keeping context, and executing.

Decision indicators should stay small and playful.

### Table

The Table is for scanning and changing:

- Decision,
- Impact,
- Effort,
- Ready / Blocked,
- Status.

Driver rows can expand and collapse.

Do not add methodology columns merely because the underlying philosophy knows about them.

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

---

## Progress

Progress should reflect active work.

Later, Hand off, and Drop should not make the user feel that an intentionally narrowed plan is permanently incomplete.

Reward useful execution, not completion theater.

---

## Design test

Whenever a new planning concept is proposed, ask:

> Does exposing this concept make the next useful action clearer?

If yes, expose the smallest possible control.

If no, keep the idea inside the reasoning layer or remove it.

Mandala should feel like a simple game about getting unstuck, not Jira wearing colorful clothes.
