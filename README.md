# IndexedSearch

TypeScript candidate search project recovered from the photographs in
`Indexed search-20261023T023156Z-1-001/Indexed search`.

The photographed source has been restored into the original folder structure.
Build metadata and the verification tests were added during recovery. See
[RECOVERY.md](RECOVERY.md) for source-image references, inferred text, and files
whose contents were never photographed.

## Data flow

```text
Salesforce Contacts
  → SalesforceCandidateRepository / CandidateMapper
  → FullIndexCandidates or IndexCandidates
  → TemplateProfileGenerator + LocalEmbeddingProvider
  → OpenSearchDocumentIndex

Search query
  → SearchCandidates + LocalEmbeddingProvider
  → OpenSearchHybridSearch (lexical + vector, RRF pipeline)
  → CandidateSearchResult[]
```

The embedding provider uses the photographed BGE base English model and the
OpenSearch mapping expects 768 dimensions.

## Local setup

Use Node.js 22 or newer:

```powershell
npm install
Copy-Item .env.example .env
```

Fill in your OpenSearch endpoint and credentials in `.env`. The example contains
placeholders, not the credentials visible in the photograph. The photographed
Salesforce authentication service uses the hardcoded org alias `rajarshi` and
expects Salesforce CLI (`sf`) to be installed and that org to be authenticated.

The first actual embedding operation downloads the model through `fastembed`.
The photographed index initialization installs an RRF search pipeline; its error
message specifies a cluster supporting `score-ranker-processor` (OpenSearch
2.19+). The `search` command also calls this initialization before searching.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

The recovery tests use local doubles for Salesforce, embeddings and OpenSearch.
They do not authenticate to services, write remote indexes, or download a model.
Live service behavior has not been verified as part of recovery.

## Commands

After configuring the services:

```powershell
# Read all photographed Salesforce Contact fields and index searchable candidates.
npm run full-index

# Reindex specified contacts.
npm run index-candidates -- <SalesforceContactId> <AnotherContactId>

# Enrich/reindex the contact IDs in presentation/cli/additionalSkills.ts.
npm run partial-index

# Search; the photographed CLI prints up to 10 results.
npm run search -- "Business analysis experience"
```

The Salesforce mapper intentionally matches the photos: it leaves `languages`
empty and `location` undefined, and the change-tracking method still throws
`Not implemented`.
