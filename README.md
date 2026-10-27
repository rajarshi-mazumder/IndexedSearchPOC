# IndexedSearch

Candidate search recovered from photographs, now adapted for **Amazon OpenSearch
Serverless NextGen** and **Amazon Bedrock Titan Text Embeddings V2**.

The application retrieves Salesforce Contacts using the existing SOQL query,
Salesforce CLI authentication, and candidate mapper. It prepares structured fields
and expertise text. OpenSearch calls Bedrock to generate document and query
embeddings, builds the indexes, and returns hybrid lexical/semantic results.

Use the [Angular console](#angular-console) for buttons, progress, batch previews,
and search tables, or use [the FSB commands below](#full-sandbox-fsb-fetch-embed-and-search).

## Angular console

From the repository folder:

```powershell
git pull
npm ci
npm run ui
```

Open **http://127.0.0.1:4310**. Keep that terminal running while using the console.
`npm run ui` builds Angular and starts the local API; subsequent launches can use
`npm run ui:serve` until UI code changes. The npm scripts use the project's pinned
Node 24 runtime, including the Angular build.

1. **Configuration:** save a named configuration with Salesforce org alias `full`,
   your AWS profile/region, collection endpoint, registered model ID, role ARN,
   index `candidates-fsb`, and dataset folder `fsb`. Enable **Derive pipeline names
   from the index** to use `candidates-fsb-ingest` and `candidates-fsb-hybrid`.
2. **Fetch candidates:** choose `fsb`, **1,000 records per file**, and **1 batch this
   run**. Click **Fetch new dataset** once, then **Resume fetch** for subsequent
   batches. Choose more batches when ready. This step only retrieves Salesforce
   data; it does not call OpenSearch or Bedrock.
3. **Embed & index:** choose dataset `fsb` and destination index `candidates-fsb`.
   Click **Set up index** once for a new index. If setup returns a model ID, click
   **Use model in configuration**. Select saved batch files and click **Embed
   selected files**. Files run sequentially; each file uses bounded bulk writes.
4. **Search candidates:** select the same index, enter your query, and click
   **Search candidates**. Results show rank, score, name, title, company, skills,
   and job functions. Sort columns or open candidate details.
5. **Activity:** inspect live operations, logs, completed-file counts, errors,
   configuration snapshots, and the latest 100 runs.

The batch library lists files with pagination and previews 20 candidates at a
time. Files saved by the batched CLI under `.cache/candidates/<dataset>/` are
also available here. The **Last embedding** column records runs performed through
this console for the selected collection, model, and index; it is not a live
count of OpenSearch documents or a record of CLI indexing.

Changing an operation's index derives matching pipeline names for that operation.
Changing the dataset selects another local export folder. Fetching has no
OpenSearch destination: files remain reusable for any compatible index. Export
resume requires the original Salesforce org and batch size. Re-embedding a file
upserts the same Salesforce IDs, progressively adding to the selected index.

Settings initially come from `.env`. Saved profiles and operation history live
in `.cache/ui/`; saving a UI configuration does **not** edit `.env` or change CLI
defaults. AWS credentials and Salesforce tokens stay with the server's existing
AWS profile and Salesforce CLI login. To change the actual login, use `sf` or AWS
CLI on the machine running the console.

Switching tabs or refreshing the browser does not stop a running operation.
**Stop** finishes the current fetch batch or bulk request before stopping; retry
an unfinished embedding file to complete it. Keep the server terminal open;
closing it interrupts workers. Resume fetching or retry unfinished files after
restart. If a forcibly killed fetch leaves `.export.lock`, follow the lock error's
instructions after confirming its process has stopped.

The console binds to loopback and allows one data-changing operation plus a search
at a time. A workspace lock prevents a second console instance from writing the
same history. Do not run separate CLI writers against the same dataset/index
while a console operation is active. Existing collection permissions still apply.

### Console development and checks

```powershell
npm run typecheck
npm test
npm run build
npm run ui:build

# Once, install the browser used by the offline UI test.
npx playwright install chromium
npm run test:ui
```

`test:ui` starts an isolated local fixture on port 4321 and uses the real API,
worker, export, indexing, and search code with fake Salesforce/AWS adapters. It
makes no Salesforce or AWS calls. Screenshots and failure traces go to
`.cache/ui-tests/`. `test:e2e` elsewhere in this README remains a separate **live
AWS** demo check.

## Run the configured dummy-data demo

This workspace is configured for the Tokyo collection `indexed-search-dev` and
the index `candidates-demo-titan-v2`. The local `.env` selects the dedicated
`indexed-search-demo` AWS profile. Credentials are stored in your AWS credentials
file, outside the repository.

The 100 fictional candidates in
[`dummy-candidates.ts`](infrastructure/dummy/dummy-candidates.ts) implement the same
`Candidate` DTO used by Salesforce. `DummyCandidateRepository` implements the same
read port and feeds the existing indexing use case; embedding and search use real
OpenSearch and Bedrock services.

```powershell
npm run search -- "Java Spring Boot Kafka microservices"
npm run search -- "React TypeScript accessible web interfaces"
npm run search -- "budget forecasts financial modeling"

# Re-embed/upsert the same 100 fictional records after editing the fixtures.
npm run index-demo

# Explicit live checks: stored vectors, lexical, semantic, and hybrid queries.
npm run verify-demo

# Full live E2E: reindex all fixtures, verify fresh vectors, update selected IDs,
# and exercise both the search use case and the CLI.
npm run test:e2e
```

`npm` commands use the pinned project-local Node 24 runtime. Check it with
`npm run node-version`. No Salesforce CLI or login is needed for the demo.
`verify-demo` reads the existing demo data. `test:e2e` also writes the dummy data
and regenerates embeddings. Both make billed AWS requests; ordinary `npm test`
stays local. Live checks require an index name containing `demo`.

The collection group has minimum capacity 0 and maximum capacity 2 OCUs for each
of indexing and search. It can sleep after 10 idle minutes. The first request after
sleep may take longer. The collection and its storage persist between sessions.

## Data flow

```text
Salesforce CLI login -> SalesforceQueryClient (all query pages)
                    -> SalesforceCandidateRepository / SalesforceCandidateMapper
                    -> IndexCandidates (all candidates or selected IDs)
                    -> CandidateDocumentFactory / TemplateCandidateProfileGenerator
                    -> OpenSearch bulk API + text_embedding ingest pipeline
                    -> Titan V2 (1024 dimensions) -> candidate index

Search text -> SearchCandidates -> OpenSearchHybridSearch
            -> multi_match (BM25) + neural query (same Titan model)
            -> min_max normalization + weighted arithmetic mean (25% lexical / 75% semantic)
            -> CandidateSearchResult[]
```

Application use cases depend on ports; the composition root injects adapters.
The profile generator and document mapper are pure. Setup owns model/pipeline/index
installation; ordinary indexing and search commands never install infrastructure.
There is no local embedding model, model download, SQLite branch, or separately
provisioned Amazon OpenSearch Ingestion service.

## Code responsibilities

Source files are organized by responsibility, with wiring in the composition root.
Each primary class/interface has a matching, descriptive kebab-case filename.

| Location | Responsibility |
| --- | --- |
| `domain/entities/` | Candidate, prepared document, and search-result data contracts |
| `application/ports/` | Contracts for candidate retrieval, document indexing, search, and profile generation |
| `application/usecases/index-candidates.ts` | Retrieve all or selected candidates, prepare bounded batches, submit documents |
| `application/usecases/search-candidates.ts` | Validate a search request and delegate through the search port |
| `application/services/` | Prepare candidate documents and generate readable profile/embedding text |
| `application/services/snapshotting-candidate-repository.ts` | Save successfully retrieved candidates before indexing or export completes |
| `infrastructure/salesforce/` | CLI authentication, paginated queries, and Salesforce-to-candidate mapping |
| `infrastructure/dummy/` | Fictional candidates and an interchangeable read repository |
| `infrastructure/json/` | Validate, atomically save, and read local candidate snapshots |
| `infrastructure/opensearch/` | Signed client, bulk writes, document mapping, hybrid search, and separate setup |
| `presentation/cli/` | Parse command-line arguments, call use cases, and display results |
| `ui/` | Angular screens, forms, candidate tables, and progress subscription |
| `presentation/http/` | Local HTTP routes, static Angular assets, and server startup |
| `presentation/worker/` | Fixed operation worker and structured IPC |
| `application/services/candidate-operation-service.ts` | Operation lifecycle, concurrency, configuration snapshots, and history |
| `application/services/candidate-console-operation-executor.ts` | Fetch/setup/search orchestration and sequential file embedding through injected ports |
| `application/services/candidate-dataset-service.ts` | Paginated dataset queries and completed embedding receipts |
| `infrastructure/process/` | Worker processes and exclusive console workspace lock |
| `shared/candidate-console-contracts.ts` | Browser/API/worker request and result contracts |
| `bootstrap.ts` | Construct and inject adapters; own connection lifetimes |

`CandidateDocumentIndex` exposes only bulk writes. The unused change-tracking,
query-builder, and filter contracts have been removed. Salesforce and dummy
sources share the same indexing use case and CLI. The historical hardcoded
Salesforce-ID skill enrichment command has been removed; candidate skills come
from the chosen source.

## Prerequisites

- Node.js **22.19 or newer**; Node 24 LTS is recommended. The current Salesforce SDK
  depends on a version of Undici that requires at least Node 22.19. This project's
  development dependencies include Node 24 for its npm scripts.
- For Salesforce ingestion only: Salesforce CLI (`sf`), authenticated to the org
  configured by `SF_TARGET_ORG`.
- An AWS profile or IAM role with access to the Serverless collection.
- A **NextGen VECTORSEARCH collection in Tokyo (`ap-northeast-1`)**.
  Follow [AWS preparation](docs/aws-serverless-setup.md) for collection, IAM,
  network/data access policies, and scale-to-zero configuration.

## Configure and install

For a fresh checkout (this workspace already has its demo `.env` configured):

```powershell
npm ci
Copy-Item .env.example .env
```

Set the collection endpoint, AWS profile/region, Salesforce org alias, and Bedrock
invocation role ARN. The AWS SDK uses its default credential chain; credentials
can come from AWS profiles/SSO, environment variables, or an IAM role. Do not put
OpenSearch usernames/passwords in the configuration.

Use a **new index** for this migration. The original BGE model generated
768-dimensional vectors; Titan V2 generates 1024-dimensional vectors. They cannot
share an index. Defaults use `candidates-titan-v2`.

## One-time OpenSearch setup

```powershell
npm run setup-opensearch
```

This command operates on the already-provisioned collection. It:

1. Creates or reuses a named Bedrock connector and registered remote model.
2. Verifies the remote model by simulating an ingest document and checking that
   1024 finite vector values are returned.
3. Installs the embedding ingest pipeline and hybrid normalization pipeline.
4. Creates the index with its default ingest pipeline and model metadata.

Copy the printed `OPENSEARCH_MODEL_ID` into `.env`. It is the OpenSearch model ID,
not the Bedrock model name. The same ID is used for document and query embeddings.

Setup can be rerun by one operator. It reuses resources by name and rejects
incompatible existing indexes or ingest pipelines. For another embedding model
or schema, choose new index and pipeline names and reindex. Do not run setup
concurrently from multiple instances. Runtime commands do not perform setup.

Allow up to 15 seconds for new resources to become visible. If a newly registered
model is not immediately visible during simulation, rerun setup after that interval.
A failed simulation prevents pipeline/index installation.

The setup command makes a small, billed Bedrock inference request. It does not
create the AWS collection, IAM roles, budgets, or other account infrastructure.

## Index and search

### Full sandbox (FSB): fetch, embed, and search

For a large sandbox, use [resumable batch exports](docs/batched-sandbox-ingestion.md).
Fetching defaults to **one file of up to 1,000 records**, not the whole org.
Fetch and embedding progress are printed separately. You decide how many new files
to fetch and which file/index to embed on each invocation.

The Salesforce query now selects the standard Contact `Title` field and maps it
to `candidate.title`. Other custom fields and the `TagConnector__r` relationship
still need to match the connected org's schema.

```powershell
# 1. Pull the latest code on the machine connected to Salesforce and AWS.
git pull

# 2. Fetch the first 1,000 Contacts from the authenticated sandbox alias "full".
# Saves batch-000001.json and checkpoint.json. No embedding happens here.
npm run fetch-candidates -- --org full --output-dir .cache/candidates/fsb --batch-size 1000 --max-batches 1

# 3. Prepare the destination index and pipelines once. Keep the working model ID
# and AWS connection settings in .env; --index overrides the index/pipeline names.
npm run setup-opensearch -- --index candidates-fsb

# 4. Embed/index the first file into candidates-fsb.
npm run index-json -- --file .cache/candidates/fsb/batch-000001.json --index candidates-fsb

# 5. Whenever ready, fetch the next 1,000 Contacts using the saved cursor.
# Saves batch-000002.json; existing committed files remain in place.
npm run fetch-candidates -- --org full --output-dir .cache/candidates/fsb --resume --max-batches 1

# 6. Add the second file to the SAME index, growing the searchable dataset.
npm run index-json -- --file .cache/candidates/fsb/batch-000002.json --index candidates-fsb

# 7. Search the records indexed so far.
npm run search -- --index candidates-fsb "Java Spring Boot Kafka microservices"
```

Run each command after the previous one succeeds. Later fetches keep using
`--resume`; select the resulting `batch-000003.json`, `batch-000004.json`, etc.
explicitly when indexing. Change `--max-batches 1` to `--max-batches 10` to fetch up
to ten additional files in one invocation. The last file may have fewer records.

Fetching only creates local files; it never starts embedding. Each `index-json`
operation embeds only the chosen file and upserts it into the specified index.
Re-indexing a file updates the same candidate IDs without creating duplicates,
but can regenerate embeddings. Allow approximately 10-15 seconds after indexing
before searching. Use these batch commands instead of unselected `full-index`.

Batch files and earlier single-file snapshots use the same format, containing
mapped candidate DTOs before embedding. Data under `.cache/` is ignored by Git:

```json
{
  "version": 1,
  "exportedAt": "2026-10-26T00:00:00.000Z",
  "candidates": []
}
```

The actual `candidates` array contains the retrieved records: ID, name, title,
company, salary, skills, systems, industries, job functions, and other DTO fields.
There are no embedding vectors or Salesforce access tokens in the snapshot.
You can inspect or edit the candidate fields before indexing; keep the versioned
envelope and valid DTO field types intact.

Explicit source flags and custom files are supported by the same indexing CLI:

```powershell
npm run index-candidates -- --source=json --file=.cache/candidates/reviewed.json

# Export a selected contact, or select contacts from an existing snapshot.
npm run fetch-candidates -- --org full --file=.cache/candidates/selected.json 003000000000001
npm run index-json -- 003000000000001
```

On Windows PowerShell, if its `npm` wrapper drops forwarded flags, use `npm.cmd`
in these examples. Without `--index`, the env index/pipeline settings still apply.
An explicit `--index NAME` consistently selects `NAME`, `NAME-ingest`, and
`NAME-hybrid` for setup/index/search. Keep the working registered model ID in `.env`.

Selected-ID Salesforce indexing saves the successful retrieval before any bulk
write. If indexing fails, that snapshot remains available to retry with
`index-json`. If fetching or saving fails, indexing does not start. Snapshot
replacement uses a temporary file and rename, so a failed fetch does not replace
an existing file. JSON mode validates the entire file and never logs in to
Salesforce or automatically refreshes a missing/invalid snapshot.

Each selected-ID fetch replaces its output file with exactly that selection.
Batch exports instead save numbered files and advance `checkpoint.json` after
each saved file. `--resume` adds more files with bounded memory. Reindexing JSON
generates embeddings again using the current AWS configuration. To switch AWS
accounts, use that account's profile, endpoint, role, index/pipelines, and model ID.

```powershell
# Upsert selected contacts.
npm run index-candidates -- 003000000000001 003000000000002

# Select the dummy source and upsert selected fixtures.
npm run index-demo -- demo-java-platform demo-react-frontend

# Explicit source selection using the shared CLI.
npm run index-candidates -- --source dummy

# Search using both lexical and semantic matching.
npm run search -- "Business analysis experience"
```

`full-index` and `index-demo` are aliases for the same `index-candidates.ts` CLI.
The default source is Salesforce; `--source json` uses the snapshot instead.
Unselected direct Salesforce indexing (`full-index` or `index-candidates`) and
full single-file fetches now fail with guidance to use bounded exports, preventing
the `Invalid string length` failure from serializing a million-contact sandbox.
Omitting IDs for JSON/dummy mode indexes that file/source; providing IDs selects
only those records. The internal use case treats an explicit empty ID array as no work.
Existing default `index-json` still reads `.cache/candidates/salesforce-candidates.json`;
always supply the new batch `--file` for sandbox exports.

The ingestion adapter sends batches of up to 100 documents, uses Salesforce IDs as
document IDs, and retries transient bulk failures for the affected documents only.
Permanent failures produce a nonzero exit status. Some documents may already be
written when a batch fails; rerunning updates the same IDs. Each reindex can invoke
Bedrock again.

Serverless manages refreshes. Allow about 10-15 seconds after indexing before
checking search results. The first request after scale-to-zero can take 10-30
seconds; the client allows a 120-second request timeout.

Lexical field boosts preserve the recovered ranking priorities (skills, title,
job functions, systems, expertise categories, then profile). Lexical queries use
`cross_fields` so matching terms can occur across candidate fields, with
`minimum_should_match: "2<30%"`: all terms for queries of up to two terms,
otherwise 30% of terms (rounded down, with at least one match). The earlier per-field 75% requirement
excluded useful lexical evidence from longer natural-language queries.
The two result sets
use 25% lexical and 75% semantic weight after score normalization. This keeps
useful lexical evidence while reducing the influence of weak word matches.
This replaces the recovered RRF
pipeline, so rankings and score values will differ. Relevance still needs checking
against representative candidate queries.

## Current synchronization boundaries

- Full indexing is an **upsert of all returned searchable contacts**, not a
  replacement snapshot. Salesforce deletions and contacts that become unsearchable
  are not automatically removed from an existing index.
- Indexing is an explicit CLI operation; no scheduler or change-data-capture worker
  runs automatically.
- The recovered mapper still leaves languages empty and location undefined.
  No new Salesforce fields or inferred filters were introduced.
- Sandbox exports keep only one batch of at most 1,000 Contacts in memory, use an ID
  cursor rather than OFFSET, and atomically persist each file before its checkpoint.
  They traverse live data; updates to already-exported IDs require a fresh export.
- Fetch checkpoints track exported files, not embedding completion. Each explicit
  `index-json --file ... --index ...` adds that selected file to the target index.

## Verification

See the [100-candidate benchmark results](docs/candidate-search-benchmark-results.md)
for measured accuracy, the fixed query set, ranking changes, and limitations.

```powershell
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Tests cover bounded pagination, file/checkpoint failures, resuming across runs,
export locks, index overrides, auth argument selection, document serialization, indexing
and selective retries, local snapshot export/reuse/failure handling, hybrid requests/results, setup compatibility, and real
AWS SigV4 signing against a local HTTP server. Other external calls use doubles.
Neither the tests nor the build access Salesforce, Bedrock, or a live collection.

`npm run test:e2e` invokes the real indexing CLI, waits for fresh `indexedAt`
timestamps on all 100 candidates, checks DTOs and embedding input text, and validates
nonzero finite 1024-dimensional vectors. It then reindexes selected IDs and checks
that the document count is unchanged and the other 98 records are untouched.
Finally it runs lexical, semantic, hybrid, and search-CLI assertions, followed by
280 ranking checks:

- 100 exact-role lexical lookups, requiring the expected candidate first.
- 100 role-plus-skill hybrid queries, requiring the expected candidate first.
- 40 fixed natural-language queries, each checked through hybrid search (first)
  and vector-only search (top five). Twenty are development cases and twenty are
  reserved validation cases.

The profiles span 37 industry labels, including healthcare, education, trades,
finance, law, hospitality, science, creative work, and software. The fixed query
judgments live in `tests/candidate-search-benchmark-cases.ts`, separately from
candidate data and production code. Benchmark reports include every query,
returned IDs/scores, expected rank, first-place accuracy, recall at five, MRR at
ten, and SHA-256 hashes of the dataset and judgments. Reports are saved under
`.cache/search-benchmarks/` even when ranking checks fail. A failed relevance
check makes the command exit unsuccessfully.

These are synthetic retrieval benchmarks with one designated answer per query.
Perfect first-place accuracy on this set does not establish perfect matching on
unseen recruiter queries, real resumes, multilingual queries, or hard constraints
such as location and salary.

Representative real-candidate relevance still needs verification when Salesforce
is connected. Search requires no Salesforce login once documents are indexed.
Use separate index and pipeline names when moving from the fictional demo to real
Salesforce records.

The original reconstruction is preserved in local commit `f02fa2e`.
[RECOVERY.md](RECOVERY.md) records the photographs and reconstruction assumptions;
its original filenames refer to that baseline. Current TypeScript files use
kebab-case names.
