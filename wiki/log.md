# Wiki log

Append-only timeline. Newest entries at the bottom.

## [2026-05-28] bootstrap | Project docs wiki

- Created `wiki/`, `raw/`, `wiki/SCHEMA.md`, initial concept pages and source summaries.
- Ingested (read-only from live repo): `SPEC.md`, `README.md`, `.claude/docs/workflow.md`, `.claude/docs/vue.md`, `.claude/docs/firebase.md`.
- Pages touched: overview, all `concepts/*`, `sources/spec`, `sources/readme`, `sources/claude-docs`, `index.md`.
- Open: `CONTRIBUTING.md`, `firestore.rules`, and `tasks/plan.md` not yet summarized as source pages.

## [2026-06-07] sync | FCM removed, notifications now in-app inbox

- Trigger: docs described FCM Web Push, but code removed it (S4.1 -> S4.2 swap, per `netlify/functions/notify-list-event.ts` header). `push.service.ts`, `firebase-messaging-sw.js`, `pushEnabled`, `fcmTokens` all gone; only a harmless `messagingSenderId` config field remains.
- Pages touched: overview, concepts/data-model, concepts/auth-and-collaboration, concepts/ci-deploy, sources/spec.
- Also synced (outside wiki): `.claude/docs/firebase.md`, `README.md`, `SPEC.md` (user story, stack table, file tree, checklist; added a changelog entry recording the swap, kept the old strikethrough history).
- Notes: notifications are now an in-app inbox - `notify-list-event` writes one doc per recipient into `users/{uid}/notifications/{id}`, rendered in an anchored popover, FIFO-capped at 50/user, no browser permission / service worker.
