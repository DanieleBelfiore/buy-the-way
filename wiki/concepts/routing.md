---
type: concept
tags: [vue-router]
sources: 1
updated: 2026-10-13
---

# Routing

Defined in `src/router/index.ts`. History mode: `createWebHistory`.

## Routes

| Path | Name | View |
|------|------|------|
| `/` | home | LandingView (signed-in users are sent to `lists`) |
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

Public routes (no auth): names in `PUBLIC_ROUTE_NAMES` (`src/router/meta.ts`) - home, login, email-link callback + legal pages.

## Auth guard

`beforeEach(authGuard)`:

- Waits for auth `ready`
- Unauthenticated non-public -> `login`
- Authenticated on `login` or `home` -> `lists`

## Default list boot redirect

Once per session: first navigation to `lists` with `from.name === undefined` may redirect to `list-detail` if the user has a `defaultListId`. Re-armed in tests via `__resetDefaultListRedirect`.

The guard reads the id from a local cache first (`authStore.cachedDefaultListId()`, `localStorage` key `btw:defaultListId:<uid>`) and only awaits the profile when the cache has no entry for that user. With a cache hit the profile still loads in the background and rewrites the cache, so a default changed on another device takes effect one cold open later. See [cold boot](offline-and-sync.md#cold-boot).

## Deep links

Hard refresh on `/lists/:id` must work: **ListDetailView** (and every view) loads subscriptions in its own mount - see [architecture](architecture.md).
