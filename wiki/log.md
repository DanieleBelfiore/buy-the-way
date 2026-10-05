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

## [2026-10-05] sync | History-based suggestions (wand)

- Trigger: new feature. `src/domain/suggest.ts` (`buildSuggestions`), `SuggestSheet.vue`, wand button in the `ListDetailView` header, new `addedVia` value `suggested` (rules + rules test).
- Pages touched: concepts/data-model (history now has a reader, new suggestions section, provenance table).
- Also synced (outside wiki): `SPEC.md` and `README.md` file trees.
- Notes: heuristic only, no AI or external service. History recording is unchanged; every recorded entry and item counts as bought.

## [2026-10-05] sync | Notifications switched off, favorites cap 60, suggest sheet restyle

- Trigger: owner request. `src/domain/features.ts` adds `FEATURES.notifications = false` (bell hidden in `ListsView`, `notifyListEvent` no-op, e2e spec skipped). `FAVORITES_MAX` raised 30 -> 60. `SuggestSheet` rows now use the favorites tile look, grouped by category with per-product icons.
- Pages touched: overview (notifications status), sources/spec (favorites cap).
- Also synced (outside wiki): `SPEC.md` favorites cap, `tasks/todo.md` backlog entry for removing notifications.
- Notes: notification code, rules and the Netlify function are still in the repo on purpose; only the switch changed.

## [2026-10-05] sync | UI polish pass on lists and list detail

- Trigger: owner-requested frontend review. List detail: stats strip now leads with a bought-progress bar (`stat-progress`) plus `bought/total`, item count and last-updated moved to a smaller second row next to the wand button; row action icons (priority, settings, remove) are muted gray, orange stays for urgent only; the empty-list footer button is neutral; the empty state offers "suggest a shop"; long list names wrap on two lines. Lists overview: logo shrinks once the account has lists; pin button is a 44px target. App version moved from the lists overview to the settings view.
- Pages touched: none beyond this log (no architecture or data change).
- Follow-up same day: item rows gained a check circle on the left (empty = to buy, filled = bought), list cards always show a count line ("Empty" when there are no items), and the header wand is hidden on an empty list because the empty state already offers the same action.
- Notes: red is now reserved for confirm dialogs. The double loading indicator (global overlay over skeleton cards) was seen only on the local emulator and is still to be checked on a real device.
