---
type: concept
tags: [mcp, oauth, netlify, firebase]
sources: 2
updated: 2026-10-15
---

# MCP server (AI assistants)

Buy The Way exposes a remote [MCP](https://modelcontextprotocol.io) server at `https://buytheway.app/mcp`, so an AI assistant (Claude Code, claude.ai, any MCP client) can read and edit the user's lists. Plan and phase history: [`tasks/mcp-plan.md`](../../tasks/mcp-plan.md). Agent rules: [`.claude/docs/firebase.md`](../../.claude/docs/firebase.md), section "MCP server".

```bash
claude mcp add --scope user --transport http buy-the-way https://buytheway.app/mcp
```

## Request path

```
client -> /mcp (Bearer token)
  -> oauthTokens lookup (hash) -> uid + grant
  -> beta gate config/mcp -> rate limits (per uid)
  -> client SDK signed in as uid (custom token, claim via: 'mcp')
  -> McpServer (17 tools) -> src/services/* -> Firestore rules
```

- **Stateless Streamable HTTP**: POST only, JSON responses, a fresh server per request. Code in `netlify/mcp/` (`handler.ts`, `server.ts`, `session.ts`), bundled by `vite.mcp.config.ts` into `netlify/functions/mcp/` during the CI deploy.
- **Rules stay the single enforcement point**: the tools call the same services as the app, signed in as the user. Items added this way get `addedVia: 'assistant'`.
- **Tools**: `list_lists`, `get_list`, `create_list`, `add_items`, `set_item_checked`, `update_item`, `remove_item`, `move_items`, `copy_items`, `rename_list`, `empty_list`, plus (2026-10-15) `get_favorites`, `set_favorite`, `suggest_items`, `get_history`, `get_stats`, `set_default_list`. No list deletion, collaborators or photos. Read tools return names, categories and quantities only: no uids, notes in history or photo URLs. `empty_list` requires an explicit scope, as the app's dialog does.

## OAuth 2.1 authorization server

First-party, in Netlify Functions:

| Endpoint | Function | Notes |
|---|---|---|
| `/.well-known/oauth-protected-resource[/mcp]` | `oauth-resource-metadata` | RFC 9728 |
| `/.well-known/oauth-authorization-server` | `oauth-as-metadata` | RFC 8414 |
| `/oauth/register` | `oauth-register` | Dynamic client registration, public clients only |
| `/oauth/authorize` | SPA consent screen + `oauth-authorize` | PKCE S256, never auto-redirects on errors (open-redirect guard) |
| `/oauth/token` | `oauth-token` | Code exchange, rotating refresh tokens with reuse detection |
| `/oauth/revoke` | `oauth-revoke` | RFC 7009 |
| (app only) | `oauth-revoke-grant` | Settings > Connected apps |

Tokens are opaque; only SHA-256 hashes are stored. Access 1 h, refresh 30 days, code 60 s.

## Data

See [data model](data-model.md#mcp-and-oauth-collections). `oauthGrants` is the only collection a user can read (their own grants, shown in Settings > Connected apps); everything else is server-only.

## Lifecycle and safety

- **Private beta**: `config/mcp` `{ open, allowedUids }`, fails closed, re-checked on every request. Public launch = `open: true` plus the launch PR (privacy page, docs).
- **Disconnect**: Settings > Connected apps deletes the grant and its tokens; the client must ask for consent again.
- **Account deletion**: `deleteAccount` revokes every grant, and `/mcp` refuses a uid that no longer exists, because a custom-token sign-in would otherwise re-create the Auth user.
- **Rate limits** per uid or `client_id`, never per IP (claude.ai shares Anthropic's IPs), except unauthenticated registration.
- **Client-neutral**: no Claude-specific wording; the UI shows the name the client registered.

## Tests

Emulator suites in `tests/mcp-integration/` (`pnpm test:mcp`): token store, handler over HTTP, all tools end to end. `pnpm smoke:mcp` imports the built bundle on Node 22 in CI.
