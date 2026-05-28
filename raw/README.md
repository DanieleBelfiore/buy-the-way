# Raw sources (immutable)

Files here are **source of truth for the wiki**, not for the app. The LLM reads them and writes synthesis under `wiki/`. Do not edit raw files after ingest except to fix typos; prefer a new snapshot or a new file.

## What belongs here

- Clipped articles, ADRs, meeting notes, design drafts
- Snapshots of external docs you want frozen at a point in time
- Exports (JSON, transcripts) you are researching

## Repo docs as sources

Canonical project specs also live at the repo root and in `.claude/docs/`. Those files **change with the code**. Track them in [`tracked-sources.md`](tracked-sources.md); on each ingest, record the git commit or date in `wiki/log.md`. Optionally copy a snapshot to `raw/snapshots/` when you need a frozen reference.

## Workflow

1. Drop or write a file under `raw/`.
2. Tell the agent: **ingest** `raw/your-file.md`.
3. Review updates in `wiki/` (Obsidian or editor).

See [`wiki/SCHEMA.md`](../wiki/SCHEMA.md) for full maintainer rules.
