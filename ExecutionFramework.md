# Mandala Execution Framework

## Purpose

Mandala is no longer just a Mandala-chart generator or a visual productivity map.

It is a **visual decision-and-execution system**.

The core loop is:

**Goal → Drivers → Actions → Triage → Execute → Learn → Revise**

The 8×8 structure creates a broad possibility space. The product then helps the user decide which parts deserve execution.

The governing principle is:

> **Decompose broadly. Triage ruthlessly. Execute narrowly. Review reality. Revise.**

---

## 1. Decomposition layer

Mandala provides the structural grammar:

**1 Goal → 8 Drivers → up to 8 Actions per Driver**

Recursive decomposition is allowed when an action is still too broad.

The system also borrows from Divide and Conquer, Work Breakdown Structure, mind mapping, progressive disclosure, controllable-action thinking, and Definition of Done.

Stop decomposing when the next physical or digital action is obvious.

---

## 2. Actionability layer

Leaf work should be controllable, specific, small enough to start, relevant to its parent, non-duplicative, and recognizable as complete.

Convert uncontrollable outcomes into controllable actions.

Bad: **Get 100 customers.**

Better: **Contact 10 qualified prospects with a concrete paid offer.**

---

## 3. Triage layer

The 64 possible actions are **not** a command to execute 64 things.

Each action can be assessed using several independent lenses.

### Impact / Effort

Use 1–5 values as rough sorting signals. High-impact / low-effort work is often attractive, but dependencies and importance still matter.

### Important / Urgent

Use Eisenhower-style binary flags:

- Important + Urgent → usually DO now.
- Important + Not Urgent → protect/schedule.
- Not Important + Urgent → consider DELEGATE.
- Not Important + Not Urgent → consider DELETE.

Importance/Urgency is not the same thing as Impact/Effort.

### Delegatability

Use No / Partly / Yes. Delegation may mean another person, contractor, teammate, AI agent, automation, or specialist tool.

### Dependencies

Keep dependencies lightweight: Ready or Blocked by another node. Do not build enterprise dependency management.

---

## 4. The 4Ds

Every piece of work can be triaged as DO, DEFER, DELEGATE, or DELETE.

### DO

The action belongs in the user's active execution plan.

### DEFER

The action matters but should not compete for attention now. A defer date is optional.

### DELEGATE

The action should happen but does not require the user to perform it directly. An optional delegate target may be recorded.

### DELETE

The action should not be executed.

**Delete is a decision, not destructive deletion.** The node remains visible because knowing what was intentionally rejected is useful planning information. Physical node clearing/removal is a separate operation.

---

## 5. Next Move

Next Move should not simply choose the highest-scoring unfinished node.

An action is normally eligible only if it is concrete, a leaf, unfinished, marked DO, Ready, and not beneath a parent marked Defer, Delegate, or Delete.

Eligible actions can then be sorted using Important, Urgent, Impact, Effort, and duration.

The score is a heuristic, not truth.

---

## 6. Views

### Map

The Map view is for spatial thinking, hierarchy, decomposition, context, branch navigation, and playful execution. It should show compact 4D/readiness cues without becoming a dashboard.

### Table

The Table view is the serious triage surface. It should make it easy to compare and edit 4D, Important, Urgent, Impact, Effort, Ready/Blocked, and Status. Driver rows remain expandable/collapsible.

### Inspector

The Inspector is for deeper metadata: 4D decision, Impact, Effort, Important, Urgent, Delegatable, Dependency, Delegate target, Defer date, Estimate, Status, and Notes.

---

## 7. Progress

Progress should reflect the active execution plan rather than punish deliberate pruning. Work intentionally marked DELETE should not remain forever in the completion denominator.

The system should reward useful execution, not completion theater.

---

## 8. Review loop

Plans are hypotheses.

Review asks:

1. Which drivers were wrong?
2. Which actions produced real progress?
3. What should be deleted now?
4. What new information changed priorities?
5. What is the next bottleneck?

The output of Review is a revised map and a smaller, better execution queue.

---

## 9. Product loop

### Explore
Generate or manually create the possibility space.

### Decide
Triage with 4Ds, Importance/Urgency, Impact/Effort, and dependencies.

### Play
Execute the strongest Ready + DO actions.

### Learn
Observe results and feedback.

### Rebuild
Change the map when reality invalidates the original plan.

This is the product's central philosophy.
