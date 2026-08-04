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

## Auth domain is proxied through the app domain (do not "simplify" this)

`VITE_FIREBASE_AUTH_DOMAIN` in production is **`buy-the-way.danielebelfiore.dev`**, not `buy-the-way-2ac6e.firebaseapp.com`. `netlify.toml` proxies `/__/auth/*` and `/__/firebase/*` to the firebaseapp.com origin so the handler is served first-party.

**Why:** installed PWAs cannot sign in with a popup. In iOS standalone, `window.open` yields a detached Safari view with no `window.opener`, so the credential `postMessage` never reaches the app and `signInWithPopup` neither resolves nor rejects - the button spins forever with no console error. The only working flow is `signInWithRedirect`, and since firebase-js-sdk 9.15 that flow is broken on Safari when `authDomain` is third-party, because ITP partitions away the state the SDK wrote there.

**Three settings must move together.** Changing one alone breaks sign-in in production:

1. `netlify.toml` proxy rules, placed **above** the SPA catch-all (first match wins).
2. Build env `VITE_FIREBASE_AUTH_DOMAIN` (GitHub secret, consumed in `.github/workflows/ci-cd.yml`).
3. **Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs -> `Web client (auto created by Google Service)`**: add the new redirect URI `https://<domain>/__/auth/handler` and the JS origin `https://<domain>`.

Skipping 3 gives `Errore 400: redirect_uri_mismatch` on every browser, desktop included, before the consent screen. Firebase Console's "Authorized domains" list is a **different** setting and does not cover this. Propagation after saving takes minutes to hours.

Keep the old `*.firebaseapp.com` redirect URI registered: local dev keeps that `authDomain` because the vite dev server has no `/__/auth` proxy.

**Netlify header caveat:** custom `[[headers]]` do not apply to responses proxied to an external host. A `[[headers]]` block for `/__/auth/*` is dead config. This works out fine - the global `X-Frame-Options: DENY` / `frame-ancestors 'none'` also never reach that path, so the popup resolver's `/__/auth/iframe` stays framable.

**Boot requirement:** `initializeAuth` in `src/services/firebase.ts` omits `popupRedirectResolver` on purpose (keeps the gapi iframe off the LCP path), so the SDK will not auto-complete a pending redirect. `consumeRedirectResult()` runs explicitly at boot in `src/main.ts`. Removing that call silently breaks PWA sign-in only, and unit tests will not catch it.

## Private state lives in a subcollection

Per-user state that no collaborator should ever read (onboarding flag, per-user defaults, etc.) lives under `users/{uid}/private/state`, not on the public `users/{uid}` doc. The public doc is readable by any signed-in user for the email-lookup flow; the private subcollection is owner-only. Don't add new flags to the public doc - put them in `private/state`.

## Server-only collections (rate limits, server-only state)

`rateLimits/{uid}_{funcName}` and any other Firestore doc that only the serverless functions touch must `allow read, write: if false` so the client SDK can't even attempt to read or mutate them. The Netlify functions go through `firebase-admin`, which bypasses rules.

## firebase-admin: modular subpaths only, never the namespace

In `netlify/functions/`, always import from `firebase-admin/app`, `firebase-admin/auth`, `firebase-admin/firestore`. Never `import admin from 'firebase-admin'` with `admin.apps` / `admin.auth()` / `admin.firestore()` / `admin.credential.cert()`.

firebase-admin 14 removed that namespace. The default import now resolves to the App API alone, so every namespace access throws `TypeError: Cannot read properties of undefined (reading 'length')` at runtime, in every function that shares `_lib/firebase-admin.ts`.

**Why it reached production:** every function suite mocked `'firebase-admin'` with a hand-written object that had `apps`, `auth()` and `firestore()`. The mock described a package shape npm had stopped shipping, so the suite stayed green while all four functions were down. Mocking a dependency asserts your idea of its API, not its API.

`tests/unit/netlify/firebase-admin-contract.test.ts` now imports the real package with no mocks and pins the exact symbols the functions use. Keep it mock-free, and extend it when a function starts depending on a new admin symbol.

## Emulator parity

If the project has emulators configured, run them in CI and locally with the rules file mounted. Unit tests with mocked Firestore lie about whether rules pass.
