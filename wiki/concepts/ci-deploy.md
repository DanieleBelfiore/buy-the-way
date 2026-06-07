---
type: concept
tags: [ci, netlify, github-actions]
sources: 2
updated: 2026-05-28
---

# CI and deploy

## Pipeline (GitHub Actions)

Workflow: `.github/workflows/ci-cd.yml`

Typical stages: quality (lint, typecheck, unit tests, coverage), Firestore rules, optional e2e, deploy to Netlify on `main`.

## E2E skip gotcha

If a job in `needs:` can be **skipped** (e.g. e2e behind `vars.E2E_ENABLED`), downstream deploy jobs must start `if:` with `!cancelled()` and explicitly allow `needs.e2e.result == 'skipped'`. Otherwise deploy never runs despite green quality/rules.

Documented in `.claude/docs/workflow.md` - see [claude-docs](../sources/claude-docs.md).

## Hosting

- **Netlify** - SPA + serverless functions
- **Firebase** - Auth, Firestore, Storage; rules deployed from `firebase/`
- CSP / `img-src` in `netlify.toml` when adding storage or asset origins

## Rollback

Optional workflow: `.github/workflows/rollback-deploy.yml` (if present in repo).

## Phase discipline

End of phase: run coverage autonomously; emit Human Verification Recap before asking for human approval (workflow.md).

## Related

- [Testing](testing.md)
