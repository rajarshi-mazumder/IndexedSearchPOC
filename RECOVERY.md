# Source recovery record

Recovery date: 2026-10-23. Source folder:
`Indexed search-20261023T023156Z-1-001/Indexed search`.

There are 63 JPG files: 54 unique photographs and 9 byte-identical duplicate
copies. Every photograph was inspected. The recovery restores 35 TypeScript
source files and 2 OpenSearch JSON configuration files. Formatting and blank
lines have been normalized; this is not a byte-for-byte copy of the lost project.

## Source-image map

Image references below omit the common `IMG_20261023_` prefix and `.jpg` suffix.
Copies with `(1)` contain the same bytes as their corresponding unnumbered image.

| Restored file | Photos | Recovery notes |
| --- | --- | --- |
| `application/ports/CandidateRepository.ts` | 103830 | Both photographed repository interfaces retained in their original file. |
| `application/ports/CandidateSearch.ts` | 103836 | Complete interface. |
| `application/ports/DocumentIndex.ts` | 103842 | Complete interface. |
| `application/ports/EmbeddingProvider.ts` | 103845 | Complete interface. |
| `application/ports/ProfileGenerator.ts` | 103848 | Complete interface. |
| `application/ports/SearchIndex.ts` | 103851 | Complete interface. |
| `application/ports/SearchRequestBuilder.ts` | 103855 | Complete interface. |
| `application/usecases/FullIndexCandidates.ts` | 103914, 103929 | Trailing portion of vector error message is clipped; reconstructed from visible context. |
| `application/usecases/IndexCandidates.ts` | 103943, 103949, 103954 | Trailing portion of vector error message is clipped; reconstructed from visible context. |
| `application/usecases/SearchCandidates.ts` | 103959 | Direct infrastructure dependency retained as photographed. |
| `domain/entities/Candidate.ts` | 104006 | Includes `Language` in the same file, as photographed. |
| `domain/entities/CandidateDocument.ts` | 104010 | Complete interface. |
| `domain/entities/CandidateSearchResult.ts` | 104014 | Complete interface. |
| `domain/search/SearchFilters.ts` | 104019 | Complete interface. |
| `domain/search/SearchRequest.ts` | 104024 | Complete interface. |
| `domain/services/TemplateProfileGenerator.ts` | 104036, 104042, 104048, 104053, 104057 | Overlapping photographs cover both generation methods and list formatting. |
| `infrastructure/config/env.ts` | 104103 | Literal Salesforce alias schema retained. |
| `infrastructure/config/index.ts` | 104108 | Complete export. |
| `infrastructure/config/opensearch.ts` | 104111 | Complete schema. |
| `infrastructure/embeddings/local/LocalEmbeddingProvider.ts` | 104116 | Import above viewport inferred as `fastembed`; visible model/API matched against installed package types. |
| `infrastructure/opensearch/config/candidate-hybrid-search-pipeline.json` | 104120 | End of description is clipped; descriptive text completed from context. Processor/settings transcribed. |
| `infrastructure/opensearch/config/candidate-index.json` | 104128, 104132, 104134 | Mapping covered by overlapping photos. |
| `infrastructure/opensearch/OpenSearchClient.ts` | 104141 | Complete class. |
| `infrastructure/opensearch/OpenSearchDocumentIndex.ts` | 104148, 104153, 104157, 104200 | Several error-message endings and the end of the bulk-failure expression are outside the viewport; reconstructed, including the empty-list fallback. |
| `infrastructure/opensearch/OpenSearchDocumentMapper.ts` | 104205, 104208 | Both mapping directions covered. |
| `infrastructure/opensearch/OpenSearchHybridSearch.ts` | 104212, 104215 | Vector error-message ending clipped; reconstructed. |
| `infrastructure/salesforce/mappers/CandidateMapper.ts` | 104226, 104230 | Includes the photographed file-local `compact` function. |
| `infrastructure/salesforce/queries/contact.ts` | 104236 | Complete query constants. |
| `infrastructure/salesforce/SalesforceCandidateRepository.ts` | 104240 | Includes the original unimplemented `getChangedSince`. |
| `infrastructure/salesforce/SalesforceClient.ts` | 104244 | Generic type constraint added for the recovered dependency's types; see below. |
| `infrastructure/salesforce/sfAuthService.ts` | 104249, 104252 | Original filename, static methods, commands, and hardcoded alias retained. |
| `presentation/cli/additionalSkills.ts` | 104301 | Contact IDs transcribed; their Salesforce case-checksum suffixes are consistent. Second skill-list line reaches the right edge; only visible skill values restored. |
| `presentation/cli/full-index.ts` | 104308 | Complete command. |
| `presentation/cli/index-candidates.ts` | 104314 | Imports at the top are partly outside the viewport; reconstructed from visible usages. |
| `presentation/cli/partial-index.ts` | 104318 | Import path endings partly clipped; reconstructed from other photographs. |
| `presentation/cli/search.ts` | 104322 | First three imports above viewport reconstructed from visible usages. |
| `bootstrap.ts` | 104346 | Long import path endings reconstructed from visible filenames and folder structure. |

## Additional images needed for exact recovery

These filenames are visible in Explorer, but **no supplied photo shows their
source bodies**. No implementations or fake stubs have been invented for them:

1. `application/services/CandidateAssembler.ts`
2. `infrastructure/search/RegexSearchRequestBuilder.ts`
3. `infrastructure/queries/contactQueries.ts`
4. `infrastructure/queries/skillQueries.ts`
5. `infrastructure/queries/tagQueries.ts`

The visible OpenSearch CLI path does not import these files, so its recovered
source can typecheck without them. Their intended behavior cannot be recovered
from their names alone.

Other files appear only as editor tabs, sometimes with deletion indicators, so
they may belong to an older implementation. The source is absent and some
locations cannot be determined:

- `SqliteClient.ts` (shown with a deletion indicator)
- `SqliteSemanticSearch.ts`
- `SqliteLexicalSearch.ts`
- `SemanticSearch.ts`
- `SearchRanker.ts`
- `OpenSearchSemanticSearch.ts`
- `OpenSearchLexicalSearch.ts`
- `OpenSearchApi.d.ts`

The sidebar also shows `scripts/`, `shared/`, `infrastructure/storage/`,
`diagrams/`, `local_cache/`, `candidate.db`, `improveSearch.plan.md` and
`structure.txt`. Their contents are not photographed. A database or cached model
cannot be recreated from its filename.

For full recovery, provide each relevant file from its imports through its final
closing brace, with overlap between images and long lines visible to the right.
The original `package.json` and `tsconfig.json` would also recover the exact
dependency versions, scripts and compiler settings.

## Reconstructed support files and deviations

- `package.json` and `tsconfig.json` were only visible as filenames. The restored
  versions are new, minimal build metadata inferred from source imports and the
  available Node.js environment. Dependency versions are recovery choices, not
  claimed original versions. `package-lock.json` was generated by installation.
- `jsforce` is pinned to 3.6.6 to work with the available Node.js 22.15.0 runtime.
- The photographed `SalesforceClient.query<T>` produces a generic constraint
  error with the installed types. Recovery adds `T extends SalesforceRecord =
  SalesforceRecord` and the corresponding type import. Runtime behavior is
  unchanged. The photo itself shows one diagnostic on this file.
- `.gitignore`, this document, `README.md` and `tests/recovery-smoke.test.ts` are
  new recovery support files, not photographed originals.
- Photo 104339 shows environment-variable names and values. `.env.example`
  restores the names, alias and index name with endpoint/password placeholders.
  The OpenAI key is shown only as `...`; it is not recoverable from that photo.
  `OPENSEARCH_SEARCH_PIPELINE` is also included because the photographed schema
  defines it. No active `.env` was created.
- Braces, punctuation at cropped edges, error-message endings, and imports above
  the viewport were completed where their intent follows from the visible code.
  They should not be treated as confirmed original wording.

## Architecture and behavior preserved for later work

Recovery preserves the photographed design rather than silently changing it:

- `SearchCandidates` depends directly on `OpenSearchHybridSearch`; it does not
  use the separate `CandidateSearch` or `SearchRequestBuilder` ports.
- `CandidateSearch` accepts a `SearchRequest`, whereas `OpenSearchHybridSearch`
  accepts a raw query and an embedding. It does not claim to implement that port.
- `TemplateProfileGenerator` is in `domain/services` but imports an application
  port. The original layer direction and naming are retained for review later.
- Several files contain multiple interfaces or file-local functions; original
  class names, filenames and import paths have been retained for recovery.
- `SforceAuthService` hardcodes `rajarshi`, despite the separate environment
  schema. Its constructor path invokes Salesforce CLI synchronously.
- `SalesforceClient.query` returns the query's `records` without an explicit
  pagination loop. No new pagination or incremental-indexing logic was added.
- The mapper leaves languages empty and location undefined, even though language
  fields are selected. `getChangedSince` still throws `Not implemented` and does
  not implement `CandidateChangeRepository.getChangedIdsSince`.
- Both indexing use cases accumulate documents before bulk indexing. The
  document index writes batches of 500 and refreshes after the bulk operation.
- `findById` catches all lookup errors and returns null, as photographed.
- Local model initialization caches the resolved model; the photographed code
  does not cache an in-flight initialization promise.
- The search CLI initializes the index/pipeline before executing the query.

## Verification

Completed successfully on Node.js 22.15.0:

- `npm run typecheck`
- `npm run build`
- `npm test` — all 10 offline tests passed.
- File/photo audit — all 54 unique photos accounted for; all 37 restored
  source/config files present and listed above.
- All 5 transcribed contact IDs have consistent Salesforce case-checksum
  suffixes. This checks transcription consistency, not whether the IDs exist in
  the user's org.

Validation uses the recreated TypeScript compiler settings and local test
doubles. It does not establish byte-for-byte fidelity or verify the current
Salesforce schema, authentication, remote OpenSearch capabilities, or actual
model downloads/inference.
