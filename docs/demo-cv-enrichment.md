# Demo CV enrichment

Add synthetic CV sections to existing candidate batch files from the Angular console. This is an optional step between fetching and embedding; it does not call Salesforce, a CV parser, Bedrock, or an LLM.

## Use it

1. Restart the console with `npm run ui` to build and load the updated UI and backend.
2. Open **Embed & index**. Choose your **Source dataset** and **Destination index** as usual.
3. Select committed batch files in the batch library. Selection can span pages.
4. In **Demo CV data**, click **Preview demo CV**. This previews at most 20 candidates from the first selected file, without saving. Open **Details** to see the CV sections.
5. Click **Add demo CV data** to enrich every candidate in the selected files. Candidates that already have a CV are skipped. Files run in batch order, one at a time, with progress and changed/skipped counts.
6. Click **Embed selected files** using your intended index. The existing embedding pipeline generates new vectors and upserts the same Salesforce document IDs.
7. Search that same index. Results containing generated data carry a **Demo CV** badge; expand **Details** to inspect the professional evidence.

Changing local JSON alone does not update OpenSearch. Files that changed since their recorded embedding run show **Needs re-embedding**. A file without embedding history shows **No recorded run**.

**Regenerate demo CV** replaces synthetic CVs for the selected candidates. The same candidate ID, seed and generator version produce the same result. Change **Demo data seed** to vary the examples. Preview shows this regenerated result; Add still skips existing CVs.

**Remove demo CV** clears only the generated CV sections. Re-embed to remove that evidence from search. Candidates with remaining professional content are updated normally. If CV removal leaves no searchable content, re-embedding deletes the old document by its Salesforce ID so stale CV evidence cannot remain searchable. Activity reports these deletions under skipped records. Records without a CV-removal marker retain the existing skip behavior.

## Stored sections

Each candidate gains an optional `enrichment.cvProfile`:

| Section | Contents |
| --- | --- |
| `source` | `kind: "synthetic"`, generator version, seed, selected archetype |
| `summary` | Professional role, experience and focus |
| `technicalSkills` | Programming languages, frameworks, databases and tools |
| `employmentHistory` | Fictional employers, roles, locations, dates and responsibilities |
| `projects` | Business descriptions, roles, technologies and contributions |
| `education` | Qualification, fictional institution and graduation year |
| `certifications` | Example professional training, fictional issuer and year |
| `languages` | Spoken languages and proficiency |

Generation uses seven local template families: Java backend, frontend, data engineering, analytics, finance, operations and cloud/platform. Existing titles, skills, systems and job functions guide selection; candidates without recognized signals get a deterministic fallback. JavaScript alone selects frontend, not Java backend. Dates use a fixed October 2026 reference so repeated runs are stable.

Real candidate IDs, source fields, tags, associations, warnings, record order and counts are preserved. Generated content stays in its own section, rather than being appended to Salesforce skill arrays. Removal leaves an `enrichment.cvProfileRemoved` marker for stale-document cleanup; adding another CV clears it.

## Search behavior

The structured CV stays in the document's `_source`. Professional summary, skills, employment responsibilities, projects, education, training and spoken languages are also included in the existing `profile` and `searchText` fields. This supplies lexical search and embedding input without changing the search command or introducing a new model.

The current enriched index schema (version 3, with `enrichment` stored but not independently indexed) supports this addition. No new index schema is needed for that index. An older index still needs the existing setup/migration procedure. Nested CV fields do not become separate salary, date or numeric filters.

Try queries that describe generated projects, such as “Java backend engineer building payment reconciliation APIs”, “frontend developer building accessible customer portals”, or “data engineer with incremental ETL and warehouse experience”. Inspect the generated preview first to pick queries represented in your selected batch. These synthetic fixtures exercise the ingestion and search flow; they do not establish relevance on real candidate CVs.

## Recovery and scale

- At most one batch (up to 1,000 candidates, maximum serialized file size 32 MB) is held at a time. No query or network request is made per candidate.
- Before a file's first modification, its exact original bytes are saved at `.cache/candidates/<dataset>/.cv-backups/<batch-file>`. Later operations preserve that first backup.
- Validated files are replaced atomically. A failed save leaves the previous file intact. Fetch checkpoints and their source/cursor information are unchanged, so fetching can resume normally.
- Stop finishes the current file. Retry Add to continue: completed CVs are skipped. Regenerate and Remove can also be rerun safely.
- Fetch, enrichment and JSON embedding share the dataset's `.export.lock`, including CLI JSON indexing. Concurrent conflicting operations fail with a clear message. After a killed process, verify it has stopped before manually removing a stale lock.
- To restore the original file, stop operations for that dataset, copy its backup over the matching batch file, then re-embed if it contains searchable content. Prefer **Remove demo CV** followed by embedding when you also need cleanup of synthetic-only indexed documents.

The fetch and embedding commands remain available unchanged:

```bash
npm run index-json -- --file .cache/candidates/fsb-enriched/batch-000001.json --index candidates-fsb-enriched
npm run search -- --index candidates-fsb-enriched "Java backend engineer building payment reconciliation APIs"
```

Enrichment itself is currently a UI operation. Selecting an index controls the subsequent embedding/search destination; enrichment modifies the selected local dataset files and does not contact that index.
