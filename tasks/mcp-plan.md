# Implementation Plan: Remote MCP server

## Overview

Let every Buy The Way user drive their lists from Claude Code, claude.ai (web, desktop, mobile) and any other MCP client, without installing anything:

```bash
claude mcp add --transport http buy-the-way https://buytheway.app/mcp
```

First use opens the browser, the user signs in with the usual Google / magic-link flow, approves the client on a consent screen and goes back to Claude.

Estimate: 5.5-8.5 working days over four phases, each closed by a checkpoint (coverage gate + Human Verification Recap).

## Architecture Decisions

- **Transport:** MCP Streamable HTTP, stateless (`sessionIdGenerator: undefined`, JSON responses, no SSE stream). Fits a Netlify Function: no long-lived connection, no session store.
- **Data access (option B, chosen 2026-10-14):** the MCP function never writes Firestore through `firebase-admin`. Per request it resolves the bearer token to a uid, mints a Firebase custom token (`createCustomToken(uid, { via: 'mcp' })`), signs in the **client** SDK with `signInWithCustomToken` and calls the existing `src/services/*`. Firestore rules stay the single enforcement point and the denormalized counters (`itemCount`, `urgentCount`, catalog, favorites) stay consistent because the same batch code runs.
- **Node build of the services:** `src/services/firebase.ts` uses `import.meta.env`, IndexedDB persistence and a module singleton. A dedicated Vite SSR build (`vite.mcp.config.ts`) aliases `@/services/firebase` to `netlify/mcp/firebase-node.ts` (memory persistence, config from `process.env`) and emits `netlify/functions/mcp.mjs` (gitignored, built in CI before `netlify deploy`). `firebase-admin` stays external, as in `netlify.toml` (bundling it breaks `SDK_VERSION` at import time).
- **Singleton safety:** a Lambda container serves one invocation at a time, so one client-SDK app per container is safe. The handler still serializes requests behind a mutex and re-signs-in only when the uid changes.
- **Authorization server:** first-party OAuth 2.1, implemented in Netlify Functions:
  - `/.well-known/oauth-protected-resource` (RFC 9728) and `/.well-known/oauth-authorization-server` (RFC 8414)
  - `/oauth/register`: Dynamic Client Registration (RFC 7591), public clients only (`token_endpoint_auth_method: none`), redirect URIs restricted to `https://` or `http://localhost` / `127.0.0.1` loopback
  - `/oauth/authorize`: SPA route (consent screen), backed by an `oauth-authorize` function that issues the code
  - `/oauth/token`: `authorization_code` (PKCE S256 mandatory) and `refresh_token` (rotating, reuse detection revokes the grant)
  - `/oauth/revoke` (RFC 7009)
- **Tokens:** opaque 256-bit random strings. Only the SHA-256 hash is stored. Access token 1 h, refresh token 30 days sliding, auth code 60 s single-use.
- **Audience binding:** the `resource` parameter (RFC 8707) must equal the canonical `/mcp` URL; tokens are bound to it.
- **Provenance:** items added through MCP get `addedVia: 'assistant'` (new value in `ITEM_ADDED_VIA` + rules allow-list).
- **Scope of tools (v1):** items CRUD, move/copy between lists, rename and empty lists. No list deletion, no collaborator management, no photos.

## Private beta gate (added 2026-10-14)

The MCP ships to production closed. Only allow-listed users can connect; opening it to everyone is a one-field change, no deploy.

- **Switch:** Firestore doc `config/mcp` `{ open: boolean, allowedUids: string[] }`, server-only (`read, write: if false`), edited from the Firebase console. Missing doc = closed. Functions cache it for 60 s per warm container.
- **Enforced in two places:**
  - `oauth-authorize`: a user not allowed gets no code. The consent screen shows "Access through AI assistants is not available yet" and redirects back with `error=access_denied`.
  - `/mcp`: every request re-checks the gate, so closing it again (or removing a uid) cuts off existing tokens within a minute.
- **Stays public on purpose:** `.well-known` metadata and client registration (rate limited). They expose nothing and clients need them to reach the consent screen.
- **App UI:** "Connected apps" renders only when the user has at least one grant, so non-beta users never see it. No client feature flag, no deploy to open.
- **Launch checklist (the "little effort" part):** set `open: true`; merge the launch PR prepared in M4 with privacy page, README, landing/about mention. Optional afterwards: Anthropic connector directory.

## Rate limiting (added 2026-10-14)

claude.ai (web, desktop, mobile) reaches the server from Anthropic's cloud, not from the user's device, so every claude.ai user shares the same few source IPs. A per-IP bucket would throttle all of them together. Keys:

| Endpoint | Bucket key | Notes |
|---|---|---|
| `/oauth/register` | IP, high cap (`RATE_LIMITS.oauthRegisterIp`) + global daily cap (`RATE_LIMITS.oauthRegisterGlobal`) | Only unauthenticated endpoint that writes. The global cap bounds abuse even from rotating IPs. |
| `oauth-authorize` | uid (from the ID token) | |
| `/oauth/token` | `client_id` (`RATE_LIMITS.oauthTokenClient`), plus uid once the code / refresh token is resolved | Never per IP. |
| `/mcp` | uid (`RATE_LIMITS.mcp`) | |

Exact numbers are set in M2 from the Netlify legacy free quota (125k invocations / month).

## Data model (new, all server-only writes)

| Path | Fields | Client rules |
|---|---|---|
| `oauthClients/{clientId}` | redirectUris, clientName, createdAt | `read, write: if false` |
| `oauthCodes/{codeHash}` | uid, clientId, redirectUri, codeChallenge, resource, expiresAt | `read, write: if false` |
| `oauthTokens/{tokenHash}` | uid, clientId, grantId, kind (`access`/`refresh`), expiresAt | `read, write: if false` |
| `oauthGrants/{grantId}` | uid, clientId, clientName, createdAt, lastUsedAt | `read: if uid matches`, `write: if false` |
| `config/mcp` | open, allowedUids | `read, write: if false` |

Revocation from the app goes through a function (it must delete tokens too). Expired docs are cleaned lazily on lookup; a Firestore TTL policy on `expiresAt` is set up in the console (ops step).

## Phase M1 - Services in Node (~1 day)

### Task M1.1 - Node build of the services

- `netlify/mcp/firebase-node.ts` (config from env: `FIREBASE_WEB_API_KEY`, `FIREBASE_PROJECT_ID`, ...; emulator hosts when `FIREBASE_AUTH_EMULATOR_HOST` is set)
- The integration test config (`vitest.mcp.config.ts`) applies the same `@/services/firebase` alias, so the shim is exercised from M1 on.
- The deployable bundle (`vite.mcp.config.ts`, `pnpm build:mcp`, CI step) moves to M3.1: before that there is no function to ship, and a placeholder function in production would be dead config.

**Acceptance:** `lists.service` / `items.service` run in plain Node through the shim (proved by M1.4).

### Task M1.2 - One-shot reads

Services only expose `subscribe*`. Add `fetchUserLists(uid)` and `fetchItems(listId)` (`getDocs`), reusing the existing mappers.

### Task M1.3 - `addedVia: 'assistant'`

Domain enum, rules allow-list, rules tests, any UI that labels provenance.

### Task M1.4 - Emulator integration test

`tests/mcp-integration/` + `pnpm test:mcp` (`emulators:exec --only auth,firestore`): custom token sign-in, create list + add item through services, non-collaborator gets `permission-denied`. Wired into CI next to `test:rules`.

### Checkpoint M1

Done 2026-10-14: `fetchUserLists` / `fetchItems`, `addedVia: 'assistant'` (rules + parity test `tests/unit/firebase/rules-parity.test.ts`), `netlify/mcp/firebase-node.ts`, `pnpm test:mcp` (4 tests, wired into the CI `rules` job).

## Phase M2 - OAuth authorization server (~2-3 days)

### Task M2.1 - `netlify/functions/_lib/oauth.ts` (pure logic, TDD)

PKCE S256 verify, token generation + hashing, redirect URI validation, client metadata validation, expiry helpers.

### Task M2.2 - Metadata endpoints

Both `.well-known` documents, CORS `*` (no credentials). Verify Netlify routes them ahead of the SPA catch-all.

### Task M2.3 - Dynamic Client Registration

`oauth-register` function, rate limits per the "Rate limiting" section, collection + rules.

### Task M2.4 - Consent screen

- Route `/oauth/authorize` (guarded). The auth guard must preserve the full return URL through `/login`, including the Google redirect flow and the magic-link flow (today it drops it).
- `OAuthConsentView.vue`: client name, redirect host, what it can do, Allow / Deny. it/en i18n.
- Allow posts the query + ID token to `oauth-authorize`, which validates and returns the redirect URL with `code` + `state`. Deny redirects with `error=access_denied`.

### Task M2.5 - Token + revoke endpoints

Code exchange, refresh rotation with reuse detection, revoke. Rate limits per the "Rate limiting" section (never per IP). Collections + rules + rules tests.

### Checkpoint M2

Code done 2026-10-14: `_lib/oauth.ts`, `_lib/oauth-store.ts`, `_lib/mcp-gate.ts`, functions `oauth-as-metadata`, `oauth-resource-metadata`, `oauth-register`, `oauth-authorize`, `oauth-token`, `oauth-revoke`, rewrites in `netlify.toml`, rules for the new collections, consent screen `/oauth/authorize` with post-login return (`domain/returnTo.ts`). The end-to-end OAuth flow against a deploy is still to run (needs a deploy, see recap).

Manual: MCP Inspector against a Netlify deploy preview completes the full OAuth flow.

## Phase M3 - MCP endpoint and tools (~1.5-2 days)

### Task M3.1 - `/mcp` function

Deployable bundle: `vite.mcp.config.ts` (SSR build, `firebase-admin` external), `pnpm build:mcp` emitting `netlify/functions/mcp.mjs` (gitignored), run in the CI deploy job before `netlify deploy`, web config env vars added there.

`@modelcontextprotocol/sdk` server, bearer validation, `401` + `WWW-Authenticate: Bearer resource_metadata="..."` on missing/invalid token, per-uid rate limit (`RATE_LIMITS.mcp`), custom-token sign-in.

### Task M3.2 - Tools

| Tool | Service | Annotations |
|---|---|---|
| `list_lists` | `fetchUserLists` | readOnly |
| `get_list` | `fetchItems` | readOnly |
| `create_list` | `createList` | |
| `add_items` | `bulkAddItems` (`addedVia: 'assistant'`) | |
| `set_item_checked` | `toggleChecked` / `bulkToggleChecked` | idempotent |
| `update_item` | `updateItem`, `setItemPriority` | |
| `remove_item` | `removeItem` | destructive |
| `move_items` | `bulkMoveItems` | |
| `copy_items` | `bulkCopyItems` | |
| `rename_list` | `renameList` | idempotent |
| `empty_list` | `recordListHistory` + `emptyList`, `scope: 'all' \| 'checked'` | destructive |

Notes on the list-level tools (added 2026-10-14):

- `move_items` / `copy_items` take item ids + destination list id. The services need full `Item` objects, so the tool reads the source list first and fails on unknown ids. Destination access is enforced by rules (collaborator on both lists).
- `rename_list` is admin-only (rules admin branch, same check as `ListSettingsView`). Non-admins get a clear tool error, not a raw `permission-denied`. Duplicate-name check reuses `normalizeListName` against the caller's lists, like `createList`.
- `empty_list` must reproduce the orchestration in `useListDetailActions.handleEmptyList`, not only the service call: snapshot to `lists/{id}/history` (`trigger: 'empty_fallback'`) before deleting, `urgentRemoved` from `countUrgentItems`. The app's "one snapshot per cycle" guard lives in `sessionStorage` (`domain/listHistoryCycle.ts`), which the function does not have: skip the snapshot when the latest history entry already holds the same item ids. `emptyList` also purges item photos, so the integration test runs the Storage emulator too.
- Both destructive tools describe what will be lost in their description so the client asks for confirmation.
- `empty_list` mirrors the app's `EmptyListButton` dialog ("all" vs "bought only"): `scope` is **required, no default**, and the tool description tells the model to ask the user which of the two they want unless they already said it explicitly. A call without `scope` fails schema validation. MCP elicitation would let the server ask directly, but it needs a server-to-client request mid-call, which the stateless transport does not support.

Input validated with zod schemas (lengths, enum categories), output as text + `structuredContent`. Errors mapped to MCP tool errors (`permission-denied` -> "list not found or not shared with you").

### Checkpoint M3

Code done 2026-10-14: `netlify/mcp/{handler,server,session}.ts`, 11 tools, `pnpm build:mcp` (vite.mcp.config.ts, output `netlify/functions/mcp/`, gitignored), `pnpm smoke:mcp` (imports the built bundle; run in CI on Node 22 = Lambda runtime), `/mcp` rewrite, rate limits `mcp` (120 / 10 min) + `mcpDaily` (1000 / day) per uid. Firebase web config inlined at build time from the CI `VITE_FIREBASE_*` secrets: no extra Netlify env vars. Tools return JSON text (no `structuredContent` yet). Known limit: photo purges after `remove_item` / `empty_list` are fire-and-forget in the services and may not finish once the function returns (orphaned Storage files, no user-visible effect).

Manual: Claude Code and claude.ai custom connector, real account, end to end.

## Phase M4 - Management, docs, launch (~1 day)

- Settings section "Connected apps": list `oauthGrants`, revoke button (`oauth-revoke-grant` function).
- `.claude/docs/firebase.md` (new server-only collections, custom token claim, beta gate), wiki ingest. These ship with M4.
- Launch PR, prepared but merged only when opening: privacy page (what MCP clients can access, how to revoke), README user instructions, landing/about mention.
- Ops: Firestore TTL policy on `expiresAt`, env vars on Netlify, smoke test in production.
- Deferred: Client ID Metadata Documents, Anthropic connector directory submission, more tools (collaborators, wallpaper, category order, list deletion).

### Checkpoint M4

## Risks

- **Cold start:** bundle is ~3.5 MB (client SDK + admin). Measured warm sign-in 27 ms, full create+write ~770 ms on the emulator. Production cold start to be measured in M3.
- **Lambda Node version** lower than local Node: same class of bug as the jose / ESM incident. Smoke test the deployed function, not only local runs.
- **Open registration** (DCR) is an abuse vector: rate limited, server-only storage, no secrets issued.

## Spike result (2026-10-14)

Vite SSR build with `@/services/firebase` aliased to a Node module: `createList` + `addItem` ran in Node against the Auth + Firestore emulators with rules active, after `signInWithCustomToken`. A second uid got `permission-denied` on the same list.

## Client neutrality (added 2026-10-14)

The server is plain MCP + OAuth 2.1, so any compliant client works, not only Claude. Rules to keep it that way:

- No Claude-specific wording in tool descriptions, consent screen, i18n strings or "Connected apps": say "AI assistant" and show the client name the client registered.
- Redirect URI validation accepts any `https://` URI and loopback `http://localhost` / `127.0.0.1` on any port.
- Other client to verify after the Claude ones: Gemini app "custom apps" (gemini.google.com, Settings -> Connected Apps). As of 2026-10 third-party guides report it gated behind Gemini Spark: Google AI Ultra (some say Pro), personal account, US only, English. Not available to the maintainer yet; nothing to build on our side, retest when Google widens access. It also needs the public privacy policy, so it comes after launch. Gemini CLI and Gemini Enterprise are out of scope.
