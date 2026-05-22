# Project Workflow Discipline

Patterns for multi-phase work with tests + human-verification gates.

## Phase-end coverage gate (mandatory, autonomous)

At the end of every phase / checkpoint, before declaring the phase done, autonomously run the project's coverage command (e.g. `pnpm test:coverage`). Required outcome: exit 0, coverage ≥ project threshold, zero framework warnings or unhandled errors in stderr. Fix any failure before requesting approval. Never wait for the user to ask.

## Human Verification Recap (mandatory at every phase/checkpoint)

Before saying "phase done" or asking for human approval, emit a **Human Verification Recap** containing:

1. **Automated gates run** — exact commands + results (test count, coverage %, build, lint, typecheck).
2. **Manual checks for the human** — bullet list of UI/UX/device/browser/Lighthouse/E2E items NOT covered by automated gates. Each bullet includes: URL or route, viewport/device, action to perform, expected outcome.
3. **Files changed** — clickable list grouped by purpose.
4. **Pending / deferred** — anything blocked by external action.
5. **Commit plan** — proposed commit messages (one per logical change) awaiting authorization phrase.

Skip only if the task explicitly carries no human-verification surface (rare). Never silent.

## View self-containment for direct URL access (SPA rule)

Any view reachable via direct URL (deep link, hard refresh, external link) must load all data it displays in its own mount hook (`onMounted`, `useEffect`, equivalent). Never assume a parent route/view has already populated shared state — a hard refresh on the child URL skips the parent entirely.

**How to apply:** for every view, ask: "If the user navigates here directly, does this view independently load all data it displays?" If no, add the missing store subscriptions / fetches with a guard, and clean up on unmount.

## Backend security rules per-task invariant

Whenever a task introduces a new backend resource (Firestore collection, DB table, API route, storage bucket), update the matching security/permission rules in the **same task**. Never defer to a later "rules pass" phase.

**Why:** default-deny backends silently fail at runtime. Unit tests that mock the backend won't catch it. Only manual integration testing exposes the gap — too late.

## Commit policy

- Never end a response with "Vuoi committare?" / "Ready to commit?" / "Should I commit now?". Summaries end with gate status, not commit prompts.
- Commits require one of these explicit authorization phrases: `I authorize this commit` / `commit now` / `go ahead and commit`. Single-use, expires after one commit.
