---
type: source-summary
tags: [agents, workflow, firebase, vue]
sources: 3
updated: 2026-05-28
---

# Source: .claude/docs/

**Paths:**

- [`.claude/docs/workflow.md`](../../.claude/docs/workflow.md)
- [`.claude/docs/vue.md`](../../.claude/docs/vue.md)
- [`.claude/docs/firebase.md`](../../.claude/docs/firebase.md)

**Role:** Authoritative **agent discipline** for this repo (referenced from `CLAUDE.md`). Not duplicated here - summarized for wiki cross-linking.

## workflow.md

- Phase-end `pnpm test:coverage` mandatory before phase done
- Human Verification Recap at checkpoints
- View self-containment for direct URLs
- Security rules ship with new collections (same task)
- Commit policy: explicit authorization phrases only
- CI: `needs:` + skipped jobs require `!cancelled()` on deploy `if:`

## vue.md

- Fake timers for debounced composables in tests
- Router ready before mount
- localStorage polyfill in `tests/setup.ts` (Node 26)
- Pinia subscription in child views on direct URL

## firebase.md

- Default-deny Firestore; update `firestore.rules` per task
- Subcollection `get(parent)` pattern
- Storage rules, CORS, cross-service link, no SVG uploads
- `users/{uid}/private/state` for sensitive flags
- `rateLimits/*` client deny
- Prefer emulator/rules tests over mocked SDK

## Wiki vs agent docs

| Audience | Location |
|----------|----------|
| Coding agent checklists | `.claude/docs/` |
| Human browse / synthesis | `wiki/` |

When workflow or firebase rules change, update agent docs **and** run wiki ingest on affected concept pages.

## Wiki pages fed by this source

- [testing](../concepts/testing.md)
- [ci-deploy](../concepts/ci-deploy.md)
- [data-model](../concepts/data-model.md)
- [architecture](../concepts/architecture.md)
