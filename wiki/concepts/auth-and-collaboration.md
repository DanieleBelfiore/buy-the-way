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

Opt-in FCM. Server function `notify-list-event` writes notification docs when collaborators add/check/empty/remove.

## Netlify (auth-adjacent)

| Function | Role |
|----------|------|
| `send-magic-link` | Magic link email |
| `send-invite` | Invite email (where used) |
| `find-user` | Email lookup for collaborator add |
| `notify-list-event` | Push + notification docs |

Rate limits in Firestore `rateLimits/*` - server only.

## Related

- [Data model](data-model.md)
- [Routing](routing.md)
