# Firebase / Firestore — Per-Task Rules

Activate by adding `@~/.claude/docs/firebase.md` to the project's CLAUDE.md when working with Firebase/Firestore.

## Security rules ship with the collection (mandatory)

Whenever a task introduces a new Firestore collection or subcollection, update `firebase/firestore.rules` **in that same task**. Do not defer to a later "rules pass" phase.

**Why:** Firestore is default-deny. New collections silently fail at runtime — invisible to unit tests that mock the Firestore SDK. Only caught during manual browser testing, which is the most expensive place to find this bug.

**Checklist for any service task:**
- Does this task touch a new collection path (top-level or subcollection)?
- If yes, add the matching `match /path/{id} { allow ... }` block to `firestore.rules` before closing the task.
- Test against the emulator (or staging) before declaring done — unit tests with mocked Firestore will not catch a rules bug.

## Subcollection rule shape

```
match /lists/{listId}/items/{itemId} {
  allow read, write: if request.auth != null
    && get(/databases/$(database)/documents/lists/$(listId)).data.ownerId == request.auth.uid;
}
```

The parent-document `get()` is what restricts subcollection access to the parent's owner. Don't forget it — the subcollection rule does NOT inherit the parent rule.

## Storage / RTDB / Auth

Same per-task invariant applies:
- New Storage path → update `storage.rules` in the same task.
- New RTDB path → update `database.rules.json` in the same task.
- New Auth claim consumed by a rule → ensure the claim is actually set on the user before relying on it.

## Emulator parity

If the project has emulators configured, run them in CI and locally with the rules file mounted. Unit tests with mocked Firestore lie about whether rules pass.
