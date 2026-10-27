# Build a sandbox search dataset progressively

Fetching and embedding are separate operations. Fetching needs Salesforce only;
indexing reads one local file and calls OpenSearch/Bedrock. Neither step starts
the other automatically.

## Fetch the first file

Authenticate the Salesforce CLI to the intended sandbox, for example with alias
`full`. Then run:

```bash
npm run fetch-candidates -- --org full --output-dir .cache/candidates/fsb --batch-size 1000 --max-batches 1
```

This creates `batch-000001.json` and `checkpoint.json` in that directory. Every
batch file uses the version-2 enriched candidate snapshot format. Each contains
at most 1,000 candidates, including resolved associations, tags, and employers;
no vectors or credentials are included. The query selects the configured Contact
record types (default: Candidate and CandidatePreReg), with all statuses included.
Old version-1 files remain readable, but their checkpoints cannot resume with the
new extractor. Follow the [FSB clean-start guide](fsb-clean-start.md) to replace
an old export/index, or use new dataset and index names.

Defaults are the configured `SF_TARGET_ORG`, `.cache/candidates/<org>`, a batch
size of 1,000, and **one new file per invocation**. `--org` overrides the env file
for this command only. Batch size must be between 1 and 1,000.

The CLI announces authentication, each batch request, saved file/count, and elapsed
time. While an asynchronous request is pending it prints a heartbeat every ten
seconds. Salesforce authentication commands and individual batch HTTP requests
have a 120-second timeout. The two synchronous authentication commands can each
take up to that timeout; the heartbeat cannot run while they block the event loop.

## Fetch the next file or files

```bash
# Add one more file, starting after the last committed Contact ID.
npm run fetch-candidates -- --org full --output-dir .cache/candidates/fsb --batch-size 1000 --resume --max-batches 1

# Or add up to ten new files in this invocation.
npm run fetch-candidates -- --org full --output-dir .cache/candidates/fsb --batch-size 1000 --resume --max-batches 10
```

`--max-batches` counts **new files in this invocation**, not the total export size.
The last file may contain fewer records. If a result exactly fills the last file,
a later empty query confirms completion without writing an empty file.

The implementation queries `ORDER BY Id ASC LIMIT <batch-size>`, then resumes
with `AND Id > '<last-saved-id>'` alongside the candidate record-type filter. It follows any REST continuation pages within
that bounded query. It never accumulates the whole sandbox or uses large SOQL
offsets. See Salesforce's [query response pagination](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-query)
and [OFFSET limit](https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-offset.html).

The checkpoint records the source org identity/alias, batch size, last ID, file
number, cumulative fetched count, and completion status. Resume rejects a different
org, batch size, extraction version, or configured scope/tag mapping. A Salesforce sandbox refresh changes its org ID: start a new
export directory afterward.

Files are saved before their checkpoints. If a request or write fails, committed
files remain usable. A failure between saving a file and saving its checkpoint
causes resume to re-fetch and replace that **uncommitted** file. Resume checks that
the last committed file still has its original record count and last ID; keep
export files unchanged and copy them elsewhere before editing candidate contents.

Press Ctrl+C once to request a stop after the current batch finishes and its
checkpoint is saved. A directory lock prevents concurrent fetch writers. Forced
termination may leave `.export.lock`; confirm the previous process has stopped
before removing that lock and resuming. No automatic stale-lock removal is done.

This is an ID-based traversal of live data, not a transactionally frozen snapshot
or change-data-capture process. Updates to already-exported records are not fetched
again by resume. For a fresh dataset, choose a new directory and index.

## Prepare the destination index once

Keep the working endpoint, AWS credentials, Bedrock role, and registered
`OPENSEARCH_MODEL_ID` in `.env`. Run:

```bash
npm run setup-opensearch -- --index candidates-fsb
```

When `--index` is supplied, setup, indexing, and search consistently use:

| Resource | Name |
| --- | --- |
| Index | `candidates-fsb` |
| Embedding ingest pipeline | `candidates-fsb-ingest` |
| Hybrid search pipeline | `candidates-fsb-hybrid` |

The existing registered model is reused. Explicit index names must start with a
lowercase letter, contain lowercase letters/digits/hyphens, and be at most 93
characters so the derived pipeline names fit. Without `--index`, all existing env
index/pipeline settings apply. Setup is separate and must succeed before indexing
or searching a new explicit index. If using an existing index, run setup with the
same `--index` first to install these pipeline names; no documents are deleted.

## Embed one selected file

```bash
npm run index-json -- --file .cache/candidates/fsb/batch-000001.json --index candidates-fsb

# Later, add the next file to the SAME index.
npm run index-json -- --file .cache/candidates/fsb/batch-000002.json --index candidates-fsb
```

Each invocation reads only the selected file. Internal OpenSearch bulk requests
remain at most 100 documents; progress prints after each acknowledged batch and
while waiting. Candidates without searchable expertise text are counted as skipped.
The export's fetched count therefore need not equal the searchable document count.

Stable Salesforce IDs are used as OpenSearch document IDs. Files accumulate in the
chosen index; rerunning a file upserts those same IDs rather than creating duplicate
documents. It may regenerate embeddings and incur inference charges. If indexing
fails, some records may already be written: rerun the **same file** to retry it.
There is no automatic embedding cursor, file skipping, or deletion of old records.
Keep the successful command output as your record of which files were indexed.

The fetch checkpoint never advances because of an embedding operation, and it does
not claim that exported files have been embedded. You can index any existing batch
in any order, pause, and add more whenever needed. Use a separate index for another
sandbox to avoid collisions between copied Salesforce IDs.

## Search the accumulated dataset

```bash
npm run search -- --index candidates-fsb "Java Spring Boot Kafka microservices"
```

The CLI prints the actual destination index. Allow approximately 10-15 seconds
after indexing for new records to become searchable. Only successfully indexed
records in that index participate; exporting more files alone doesn't change search.

On Windows PowerShell, use `npm.cmd` if the `npm` wrapper drops forwarded options.

## Compatibility with earlier commands

`index-json` still accepts existing single-file snapshots. A small selected-ID
export remains available:

```bash
npm run fetch-candidates -- --org full --file .cache/candidates/selected.json 003000000000001
```

Unrestricted `fetch-candidates --file ...` and unselected direct Salesforce
`full-index`/`index-candidates` now fail with instructions to use bounded exports.
This prevents repeating the giant in-memory array/JSON serialization that produced
`Invalid string length` on the full sandbox. Direct selected-ID indexing and the
dummy demo remain supported. Existing default `index-json` behavior still reads
`.cache/candidates/salesforce-candidates.json`; use an explicit batch `--file` for
new sandbox exports.
