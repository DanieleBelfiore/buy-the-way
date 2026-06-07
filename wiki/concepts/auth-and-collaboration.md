---
type: concept
tags: [auth, collaboration]
sources: 2
updated: 2026-05-28
---

# Auth and collaboration

## Sign-in

- **Google** one-tap
- **Email magic link** (passwordless); callback route `email-link-callback`
- Router `authGuard`: all routes except public set (`login`, about, privacy, terms) require auth

Profile merge: `users.service` reads public doc + `private/state`, with legacy-field migration on sign-in.

## Lists and roles

- **Owner** creates lists; only owner adds/removes collaborators (by registered email - no pending invite if email unknown)
- **Collaborators** in `collaboratorUids` - read/write items, shared category order, photos
- **Admins** - `admins` array on list doc; falls back to `[ownerUid]` for legacy docs
- Collaborator can **leave** list without owner action
- **Pending invite emails** - special rules for pre-claim read/update (see firestore.rules)

## Notifications

In-app inbox (no FCM, no browser permission, no service worker). Server function `notify-list-event` writes one notification doc per recipient into `users/{uid}/notifications` when collaborators add/check/empty/remove; the client renders them in a popover anchored to the lists view and batch-deletes on read. Bodies are templated server-side from Firestore (tamper-proof); inbox is FIFO-capped at 50 docs per user.

## Netlify (auth-adjacent)

| Function | Role |
|----------|------|
| `send-magic-link` | Magic link email |
| `send-invite` | Invite email (where used) |
| `find-user` | Email lookup for collaborator add |
| `notify-list-event` | In-app notification fan-out (one doc per recipient) |

Rate limits in Firestore `rateLimits/*` - server only.

## Related

- [Data model](data-model.md)
- [Routing](routing.md)
