# Domain migration: buy-the-way.danielebelfiore.dev -> buytheway.app

Analysis 2026-10-14. **Done 2026-10-14**: steps 1-4 completed and verified in production (301 with path and query, retiring `/sw.js` on the old host, `www` -> apex, build `authDomain` = `buytheway.app`, Google + magic-link sign-in, sender `noreply@buytheway.app`, Storage photos, installed PWA migrated). DMARC `p=none` added. Remaining: step 5 (Search Console change of address) and, after a few months, removing the old domain everywhere.

Target: apex `https://buytheway.app` as primary, `www.buytheway.app` and the old domain redirecting to it (301, path preserved).

## What does NOT change

- Firebase project id `buy-the-way-2ac6e`, the Storage bucket, `*.firebaseapp.com`: immutable, not tied to the site domain. All `buy-the-way-2ac6e` occurrences in the repo stay (`.firebaserc`, `firebase.json`, scripts, CI, the `/__/auth` proxy target in `netlify.toml`).
- User data in Firestore / Storage.
- Netlify site name `buy-the-way-2ac6e` and its `*.netlify.app` URL.

## Order matters

Code that points at the new domain must not ship before the domain works, and the old domain must keep working until the redirect is in place. Sequence:

### 1. DNS + Netlify (you)

1. Netlify -> site `buy-the-way-2ac6e` -> Domain management -> Add domain `buytheway.app` as a **domain alias** (not primary yet). Add `www.buytheway.app` too.
2. DNS at the registrar of buytheway.app, either:
   - Netlify DNS: switch the nameservers to the ones Netlify shows (simplest, Netlify manages records + certificate), or
   - external DNS: apex `A` / `ALIAS` record as Netlify indicates, `www` `CNAME` to `buy-the-way-2ac6e.netlify.app`.
3. Wait for the Let's Encrypt certificate (`.app` is HSTS-preloaded: HTTPS only, it will not load at all without the certificate).
4. Check: `https://buytheway.app` serves the app.

### 2. Auth + email providers (you, before the code switch)

| Where | What | Breaks without it |
|---|---|---|
| Firebase Console -> Authentication -> Settings -> Authorized domains | add `buytheway.app` | magic-link continue URL and Google sign-in on the new domain |
| Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client `Web client (auto created by Google Service)` | add JS origin `https://buytheway.app` and redirect URI `https://buytheway.app/__/auth/handler`. Keep the old ones and the `*.firebaseapp.com` one | Google sign-in: `Errore 400: redirect_uri_mismatch` (propagation minutes to hours) |
| Google Cloud Console -> Google Auth Platform -> Branding | add `buytheway.app` to Authorized domains; update home page, privacy policy, terms URLs | consent screen shows the old links; a branding change may trigger brand re-verification (basic scopes only, usually quick) |
| Resend -> Domains | add + verify `buytheway.app` (SPF / DKIM records in DNS) | sender `noreply@buytheway.app` rejected; until then keep the old sender |

### 3. Code switch (me, one PR)

| File | Change |
|---|---|
| `netlify/functions/_lib/branded-email.ts` | `DEFAULT_APP_URL` -> `https://buytheway.app` (also the MCP OAuth issuer and `/mcp` resource) |
| `netlify/functions/send-invite.ts`, `send-magic-link.ts` | default sender `noreply@buytheway.app` (only after Resend verification) |
| `index.html` | `og:url`, `og:image`, `twitter:image` |
| `src/views/LandingView.vue` | JSON-LD `url`, `logo` |
| `public/sitemap.xml`, `public/robots.txt` | all `<loc>` and the `Sitemap:` line |
| `src/i18n/locales/{it,en}.json` | `shareFooter`, Android microphone hint |
| `firebase/storage.cors.json` | add `https://buytheway.app` (keep the old origin during transition), then `pnpm storage:cors` |
| `netlify.toml` | comments; host-scoped redirects for the old domain (see 4) |
| `.claude/docs/firebase.md`, `README.md`, `tasks/mcp-plan.md`, wiki | domain references; re-ingest in the wiki |

Config outside the repo, same release:

- GitHub secret `VITE_FIREBASE_AUTH_DOMAIN` -> `buytheway.app` (the build bakes it in; together with the proxy and the Google Cloud redirect URI it is one of the "three settings that move together" in `.claude/docs/firebase.md`).
- Netlify env `APP_URL` -> `https://buytheway.app` if set (otherwise the code default applies); `INVITE_FROM_ADDRESS` if set.

### 4. Switch primary + redirect the old domain (me + you)

- Netlify: set `buytheway.app` as **primary domain**.
- Old domain -> new, host-scoped rules in `netlify.toml` (301, `:splat` keeps path + query, so old invite links and already-sent magic links still land on the right page).
- **Installed PWAs need care.** A PWA installed from the old domain keeps a service worker on the old origin. That worker serves the cached app shell for every navigation, so a plain 301 never reaches it. Its update check also fails, because a service worker script cannot be served through a redirect. Old installs would stay frozen on the old build. Fix: on the old host only, serve a tiny "retire" `sw.js` that unregisters itself and reloads its clients; the next navigation then follows the 301. Rule order: the `sw.js` rewrite above the old-host 301.
- Known one-time costs for existing users on the old origin (browser storage is per origin and cannot be moved): they sign in again on the new domain; local preferences (UI language, cached default list, onboarding flags) reset to defaults. Installed PWAs must be reinstalled from `buytheway.app`. Lists and items are server-side and unaffected.

### 5. After the switch (you)

- Google Search Console: add `buytheway.app`, submit the sitemap, use "Change of address" from the old property.
- Keep the old domain, its Firebase authorized domain and OAuth redirect URI registered for at least a few months (old links, old PWAs).
- Update external links (LinkedIn, portfolio, store listings if any).

## Impact on the MCP work

- Issuer, `/mcp` resource and every discovery URL derive from `APP_URL` / `DEFAULT_APP_URL`, nothing is hard-coded. Tokens are bound to the resource URL, so the domain must be final **before** the first MCP deploy: switching later would invalidate every connected client.
- No MCP token exists yet, so doing the switch before the M3 deploy costs nothing.
- `claude mcp add ... https://buytheway.app/mcp` in the docs.
