# Firebase / Firestore - Per-Task Rules

Activate by adding `@~/.claude/docs/firebase.md` to the project's CLAUDE.md when working with Firebase/Firestore.

## Security rules ship with the collection (mandatory)

Whenever a task introduces a new Firestore collection or subcollection, update `firebase/firestore.rules` **in that same task**. Do not defer to a later "rules pass" phase.

**Why:** Firestore is default-deny. New collections silently fail at runtime - invisible to unit tests that mock the Firestore SDK. Only caught during manual browser testing, which is the most expensive place to find this bug.

**Checklist for any service task:**
- Does this task touch a new collection path (top-level or subcollection)?
- If yes, add the matching `match /path/{id} { allow ... }` block to `firestore.rules` before closing the task.
- Test against the emulator (or staging) before declaring done - unit tests with mocked Firestore will not catch a rules bug.

## Subcollection rule shape

```
match /lists/{listId}/items/{itemId} {
  allow read, write: if request.auth != null
    && get(/databases/$(database)/documents/lists/$(listId)).data.ownerId == request.auth.uid;
}
```

The parent-document `get()` is what restricts subcollection access to the parent's owner. Don't forget it - the subcollection rule does NOT inherit the parent rule.

## Storage / RTDB / Auth

Same per-task invariant applies:
- New Storage path → update `storage.rules` in the same task. Current live paths: `lists/{listId}/items/{itemId}/{photo,thumb}.jpg`, collaborator-gated, content-type allow-list `image/jpeg | image/png | image/webp` (no SVG - blocks the one-tap XSS vector on a leaked download URL).
- Browser uploads also need **bucket CORS** (`firebase/storage.cors.json` + `pnpm storage:cors` / `gsutil cors set`). `firebase deploy --only storage` does not apply CORS. A missing CORS config surfaces as a browser preflight failure on `firebasestorage.googleapis.com`, not as a rules unit-test failure.
- Item-photo rules call `firestore.get()` / `firestore.exists()`. The first publish must enable the **Storage ↔ Firestore cross-service link** (Firebase Console banner, or accept the CLI prompt on `firebase deploy --only storage`). Without it, uploads fail with `storage/unauthorized` even for list owners.
- After adding a production origin, update `netlify.toml` `img-src` if thumbnails load from a new host.
- New RTDB path → update `database.rules.json` in the same task.
- New Auth claim consumed by a rule → ensure the claim is actually set on the user before relying on it.

## Private state lives in a subcollection

Per-user state that no collaborator should ever read (onboarding flag, per-user defaults, etc.) lives under `users/{uid}/private/state`, not on the public `users/{uid}` doc. The public doc is readable by any signed-in user for the email-lookup flow; the private subcollection is owner-only. Don't add new flags to the public doc - put them in `private/state`.

## Server-only collections (rate limits, server-only state)

`rateLimits/{uid}_{funcName}` and any other Firestore doc that only the serverless functions touch must `allow read, write: if false` so the client SDK can't even attempt to read or mutate them. The Netlify functions go through `firebase-admin`, which bypasses rules.

## Emulator parity

If the project has emulators configured, run them in CI and locally with the rules file mounted. Unit tests with mocked Firestore lie about whether rules pass.
