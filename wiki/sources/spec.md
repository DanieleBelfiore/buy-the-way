---
type: source-summary
tags: [spec, product]
sources: 1
updated: 2026-05-28
---

# Source: SPEC.md

**Path:** [`SPEC.md`](../../SPEC.md)  
**Role:** Product source of truth - user stories, acceptance, branding, visual direction, phased requirements.

## Highlights

- **Objective:** Mobile-first PWA, real-time shared shopping lists for individuals/couples/households.
- **Auth:** Google + magic link; mandatory login.
- **Collaboration:** Owner adds registered users by email; collaborator self-remove; new-list badges via `lastSeenLists` / private state.
- **Items:** Dual catalog autocomplete, favorites algorithm (recency-weighted, min uses, cap 30), categories, photos, voice, bulk paste, undo delete, in-app notifications inbox.
- **UX:** it/en, light/dark theme, haptics, reduced motion, onboarding tour, GDPR export.
- **Success metrics:** Sign-in <2s on 4G, sync <1s, offline zero data loss, Lighthouse PWA ≥90.

## Wiki pages fed by this source

- [overview](../overview.md)
- [auth-and-collaboration](../concepts/auth-and-collaboration.md)
- [offline-and-sync](../concepts/offline-and-sync.md)

Re-ingest when SPEC changes materially.
