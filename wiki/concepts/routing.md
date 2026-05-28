---
type: concept
tags: [vue-router]
sources: 1
updated: 2026-05-28
---

# Routing

Defined in `src/router/index.ts`. History mode: `createWebHistory`.

## Routes

| Path | Name | View |
|------|------|------|
| `/` | - | redirect `/lists` |
| `/login` | login | LoginView |
| `/auth/email-link-callback` | email-link-callback | EmailLinkCallbackView |
| `/about` | about | AboutView |
| `/privacy` | privacy | PrivacyView |
| `/terms` | terms | TermsView |
| `/lists` | lists | ListsView |
| `/lists/:id` | list-detail | ListDetailView |
| `/lists/:id/settings` | list-settings | ListSettingsView |
| `/settings` | settings | SettingsView |
| `/stats` | stats | StatsView |

Public routes (no auth): names in `PUBLIC_ROUTE_NAMES` (`src/router/meta.ts`) - login + legal pages.

## Auth guard

`beforeEach(authGuard)`:

- Waits for auth `ready`
- Unauthenticated non-public -> `login`
- Authenticated on `login` -> `lists`

## Default list boot redirect

Once per session: first navigation to `lists` with `from.name === undefined` may redirect to `list-detail` if `defaultListId` in private profile. Re-armed in tests via `__resetDefaultListRedirect`.

## Deep links

Hard refresh on `/lists/:id` must work: **ListDetailView** (and every view) loads subscriptions in its own mount - see [architecture](architecture.md).
