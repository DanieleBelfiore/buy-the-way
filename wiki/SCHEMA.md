# buy-the-way project wiki - maintainer schema

This directory is an **LLM-maintained project knowledge base** (see the LLM Wiki pattern). You write and update markdown here; humans read it (Obsidian, GitHub, editor).

## Three layers in this repo

| Layer | Path | Owner | Role |
|-------|------|-------|------|
| Raw sources | `raw/` | Human (immutable once filed) | Specs, notes, clipped articles, meeting notes |
| Wiki | `wiki/` | LLM | Synthesis, entity/concept pages, cross-links |
| Agent rules | `.claude/docs/`, `CLAUDE.md` | Human + LLM | **Source of truth for how to code and test** - not replaced by the wiki |

The wiki **compiles and connects** project knowledge. `.claude/docs/` stays the authoritative checklist for agents (workflow gates, Vue test hygiene, Firebase rules invariants). When those docs change, **ingest** them into the wiki so synthesis stays current.

## Page conventions

- **Language:** English for wiki pages (product UI is it/en).
- **Links:** Relative markdown links between wiki pages, e.g. `[data model](concepts/data-model.md)`.
- **Frontmatter (optional but preferred):**

```yaml
---
type: concept | entity | source-summary | overview | answer
tags: [firebase, testing]
sources: 2
updated: 2026-05-28
---
```

- **No em-dash** (U+2014) anywhere in the repo - use `-` with spaces or rephrase.
- **Citations:** When a claim comes from a raw source or repo file, link it: `` [`SPEC.md`](../SPEC.md) `` or `` [`raw/tracked-sources.md`](../raw/tracked-sources.md) ``.

## Directory layout

```
wiki/
  SCHEMA.md          # this file
  index.md           # content catalog (update on every ingest)
  log.md             # append-only timeline
  overview.md        # project synthesis hub
  concepts/          # cross-cutting topics
  entities/          # components, services, views (add as needed)
  sources/           # one summary page per ingested raw source
raw/
  README.md
  tracked-sources.md # registry of repo paths + ingest history
  (snapshots/)       # optional copies when you need immutability
```

## Operations

### Ingest

Trigger: user adds material under `raw/` or asks to sync from repo docs (`SPEC.md`, `README.md`, `.claude/docs/*.md`).

1. Read the source; discuss key takeaways with the user if they are present.
2. Add or update `wiki/sources/<slug>.md` (summary + link to raw path).
3. Update `wiki/overview.md` and every affected `wiki/concepts/*` and `wiki/entities/*` page.
4. Refresh `wiki/index.md`.
5. Append to `wiki/log.md`:

```markdown
## [YYYY-MM-DD] ingest | Short title
- Source: `path/to/file`
- Pages touched: overview, concepts/data-model, ...
- Notes: contradictions, open questions
```

Prefer **one source per ingest** when the user is in the loop; batch only when asked.

### Query

1. Read `wiki/index.md` to locate pages.
2. Read relevant pages; answer with citations to wiki paths and/or repo files.
3. If the answer is durable (comparison, decision record, how-to), **file it** under `wiki/concepts/` or `wiki/entities/` and index it.

### Lint

User asks for wiki health check. Report:

- Contradictions between wiki pages or wiki vs `.claude/docs/` / `SPEC.md`
- Stale claims (code changed, wiki did not)
- Orphan pages (no inbound links from index or overview)
- Concepts mentioned often but missing a page
- Missing cross-references
- Suggested ingests (unprocessed changes in `SPEC.md`, etc.)

## Index and log

- **`index.md`:** Group by category (overview, concepts, entities, sources). One line per page.
- **`log.md`:** Append-only. Prefix every entry with `## [YYYY-MM-DD] kind | title` so `grep '^## \[' wiki/log.md` works.

## Relationship to Obsidian

Open the repo root (or `wiki/`) as a vault. Graph view shows link structure. Optional: Dataview queries on frontmatter `tags` / `type`.

## Optional tooling

At scale, add local markdown search (e.g. [qmd](https://github.com/tobi/qmd)). Until then, `index.md` + ripgrep is enough.

## Bootstrap note

Initial wiki created 2026-05-28 from `SPEC.md`, `README.md`, `.claude/docs/`, and codebase layout. Re-ingest after major spec or architecture changes.
