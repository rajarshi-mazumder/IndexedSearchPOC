# IndexedSearch

Candidate search recovered from photographs, now adapted for **Amazon OpenSearch
Serverless NextGen** and **Amazon Bedrock Titan Text Embeddings V2**.

The application retrieves Salesforce Contacts using the existing SOQL query,
Salesforce CLI authentication, and candidate mapper. It prepares structured fields
and expertise text. OpenSearch calls Bedrock to generate document and query
embeddings, builds the indexes, and returns hybrid lexical/semantic results.

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

### Fetch once, inspect, and embed later

The Salesforce query now selects the standard Contact `Title` field and maps it
to `candidate.title`. Other custom fields and the `TagConnector__r` relationship
still need to match the connected org's schema.

```powershell
# Salesforce -> local JSON only. Requires SF_TARGET_ORG and a Salesforce login;
# no AWS configuration or embedding requests are needed.
npm run fetch-candidates

# Read the saved JSON and embed/index it using the configured AWS account.
npm run index-json

# Fetch fresh Salesforce data, replace the JSON, then embed/index that data.
npm run full-index
```

The default snapshot is `.cache/candidates/salesforce-candidates.json`, which is
ignored by Git. It contains the mapped candidate DTOs before embedding:

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
npm run index-candidates -- --source=salesforce --file=.cache/candidates/fresh.json
npm run fetch-candidates -- --file=.cache/candidates/reviewed.json

# Export a selected contact, or select contacts from an existing snapshot.
npm run fetch-candidates -- --file=.cache/candidates/selected.json 003000000000001
npm run index-json -- 003000000000001
```

On Windows PowerShell, if its `npm` wrapper drops forwarded flags, use `npm.cmd`
in these examples. `index-json`, `full-index`, and `fetch-candidates` without
additional flags work without argument forwarding.

Fresh Salesforce indexing always saves the successful retrieval before any bulk
write. If indexing fails, that snapshot remains available to retry with
`index-json`. If fetching or saving fails, indexing does not start. Snapshot
replacement uses a temporary file and rename, so a failed fetch does not replace
an existing file. JSON mode validates the entire file and never logs in to
Salesforce or automatically refreshes a missing/invalid snapshot.

Each successful fresh fetch replaces its output file with exactly the returned
records. A selected-ID fetch therefore creates a snapshot of that selection;
use a separate `--file` when preserving an earlier full export. Reindexing JSON
generates embeddings again using the current AWS configuration. To switch AWS
accounts, use that account's profile, endpoint, role, index/pipelines, and model ID.

```powershell
# Retrieve all Salesforce query pages and upsert searchable contacts.
npm run full-index

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
Omitting IDs indexes all candidates from the
chosen source; providing IDs indexes only that selection. The internal use case
treats an explicit empty ID array as no work.

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
- Salesforce query pagination is fixed. The repository still loads the returned
  candidate list into memory; document generation and OpenSearch writes are batched.

## Verification

See the [100-candidate benchmark results](docs/candidate-search-benchmark-results.md)
for measured accuracy, the fixed query set, ranking changes, and limitations.

```powershell
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Tests cover pagination, auth argument selection, document serialization, indexing
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
