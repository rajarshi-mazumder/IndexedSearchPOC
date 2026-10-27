# Clean-start test for the full sandbox

Run these steps on the computer where you fetched the old FSB data and configured
the working Salesforce/AWS logins. Local files and OpenSearch data are separate:
deleting one does not delete the other.

The old names shown in your screenshots were dataset folder `fsb` and index
`candidates-fsb`. This guide deletes those exact targets and starts fresh using
`fsb-enriched` and `candidates-fsb-enriched`.

## 1. Stop operations and update the checkout

Finish or stop any fetch/embed operation, then stop the console server with
Ctrl+C. In the repository folder:

```powershell
git pull --ff-only
npm ci
```

Keep the working `.env`, AWS profile, Salesforce login, collection endpoint,
Bedrock role, and registered `OPENSEARCH_MODEL_ID`.

## 2. Delete the old local FSB export

Use **PowerShell**, from the repository folder. This checks the project and the
resolved target before recursively removing only `.cache/candidates/fsb`, including
its old batch files, checkpoint, and any stale export lock:

```powershell
$repoRoot = (Resolve-Path -LiteralPath '.').Path
$projectFile = Join-Path $repoRoot 'package.json'
if (-not (Test-Path -LiteralPath $projectFile)) { throw 'Run this from the IndexedSearch repository folder.' }
$projectName = (Get-Content -LiteralPath $projectFile -Raw | ConvertFrom-Json).name
if ($projectName -ne 'indexed-search') { throw 'This is not the IndexedSearch repository.' }
$oldFsbPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot '.cache/candidates/fsb'))
if (-not $oldFsbPath.StartsWith($repoRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Target is outside the repository.' }
if (Test-Path -LiteralPath $oldFsbPath) {
    $resolvedFsbPath = (Resolve-Path -LiteralPath $oldFsbPath).Path
    if ($resolvedFsbPath -ne $oldFsbPath) { throw 'Unexpected resolved FSB path.' }
    foreach ($relativeDirectory in @('.cache', '.cache/candidates', '.cache/candidates/fsb')) {
        $item = Get-Item -LiteralPath (Join-Path $repoRoot $relativeDirectory) -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Stop: export path contains a link or junction.' }
    }
    Write-Host "Deleting old FSB export: $resolvedFsbPath"
    Remove-Item -LiteralPath $resolvedFsbPath -Recurse -Force
}
Test-Path -LiteralPath $oldFsbPath
```

The final result should be `False`. If the path check stops on a link/junction,
inspect its destination instead of bypassing the check.

If you also retained the earlier single-file FSB attempt, delete that exact file
after verifying its name; it is not part of the `fsb` directory:

```powershell
if (Test-Path -LiteralPath '.cache/candidates/full-sandbox-candidates.json') {
    Remove-Item -LiteralPath '.cache/candidates/full-sandbox-candidates.json' -Force
}
```

Other sandbox datasets and `.cache/ui` are not part of this deletion. Old Activity
entries are historical run records, not evidence that an OpenSearch index still
contains data; changing the dataset/index prevents confusing them with new runs.

## 3. Delete the old indexed FSB documents and mapping

Open your working OpenSearch UI **Dev Tools**, and select the data source for
the same collection used by `OPENSEARCH_NODE` (previously `indexed-search-dev`).
Run these requests **one at a time**, checking the response between requests:

```http
GET /candidates-fsb/_mapping
```

Confirm that the response names the old FSB index. Then:

```http
DELETE /candidates-fsb
```

This removes that entire index, its documents, and its mapping. A successful
response reports `"acknowledged": true`. Verify removal:

```http
GET /candidates-fsb/_mapping
```

An index-not-found/404 response confirms it is gone. If the first request already
returns index-not-found, there is nothing to delete under that exact name.
Do not use wildcard index names. See the official
[OpenSearch Delete Index API](https://docs.opensearch.org/latest/api-reference/index-apis/delete-index/).

If deletion returns 403, it did not delete the data. Index deletion is a separate
permission from reading/writing documents: verify `aoss:DeleteIndex` for the
selected principal and `index/indexed-search-dev/candidates-fsb` in the collection's
data access policy. Keep the scope to the intended old index. AWS documents
the [supported operations and required data access permissions](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-genref.html).

The collection, model, connector, and pipelines do not need deletion. Pipelines
are processing configuration rather than a second copy of your candidates.

If you exported/indexed FSB under additional names, inspect those exact names
and repeat the corresponding local-folder/index cleanup only for those datasets.
In particular, if `fsb-enriched` or `candidates-fsb-enriched` already holds a prior
test, either remove that exact test dataset/index too or choose a genuinely unused
pair of names for the following steps.

## 4. Configure the fresh test

Start the Angular console:

```powershell
npm run ui
```

Open `http://127.0.0.1:4310`, then save a configuration with:

| Setting | Value |
| --- | --- |
| Salesforce org alias | `full` |
| Candidate record types | `Candidate,CandidatePreReg` if both developer names exist in your org |
| Tag type overrides | `{}` initially, or your verified developer-name mappings |
| Dataset folder | `fsb-enriched` |
| Index | `candidates-fsb-enriched` |
| Derive pipeline names from the index | Enabled |
| Endpoint, model, role, AWS profile/region | Your existing working values |

Scope includes all statuses. If preflight reports a missing candidate record type,
use the exact names returned by the discovery queries; do not switch to all Contacts.
The [main README](../README.md#candidate-scope-and-tag-classification) lists default
tag mappings and overrides. Changing scope or tag mappings requires a new dataset
folder, so check them before a large export.

## 5. Fetch and inspect one batch before embedding

On **Fetch candidates**, choose 1,000 records and **1 batch this run**, then click
**Fetch new dataset** (not Resume).

Expected results:

- `.cache/candidates/fsb-enriched/batch-000001.json` and a new checkpoint.
- The JSON's top-level `version` is `2`.
- Each candidate has an `enrichment` object containing associations, resolved tags,
  profile details, employer context when available, and warnings.
- Batch Preview reports counts with skills, technologies, languages, and warnings.

Inspect a few candidates against Salesforce. Check that known tags and language
levels appear and employer/education lookups resolve to names. Empty fields can
still mean the source has no data; unknown tag types and unresolved IDs must be
investigated through the quality notes rather than treated as complete profiles.
Do not export hundreds of files until the first batch's mapping looks right.

## 6. Set up the index, embed, and search

On **Embed & index**, select `candidates-fsb-enriched`, click **Set up index**, and
wait for success. Reuse the working model ID; if setup returns a new ID, use the
console's **Use model in configuration** action before embedding.

Select `batch-000001.json` and click **Embed selected files**. Wait for success and
check indexed/skipped counts. Only successfully indexed candidates can appear in
search; candidates with no searchable professional text are skipped.

On **Search candidates**, explicitly select `candidates-fsb-enriched`. Try `Java`,
then `Candidates with experience in Java`. Look at **Skills / technologies**, open
Details, and compare expected candidates' Salesforce IDs. Search visibility may
lag behind bulk acknowledgement briefly; retry after a short wait if needed.

The first 1,000 candidates may not include your known Java candidate. To test that
candidate independently, replace the final placeholder with its real Contact ID:

```powershell
npm run fetch-candidates -- --org full --file .cache/candidates/java-check.json REPLACE_WITH_CONTACT_ID
npm run index-json -- --file .cache/candidates/java-check.json --index candidates-fsb-enriched
npm run search -- --index candidates-fsb-enriched "Java"
```

CLI uses `.env`, not saved Angular profiles. Keep the same model, endpoint, and
scope/tag settings in `.env` before running those commands. The explicit `--index`
selects the matching pipelines.

For an exact check in Dev Tools, substitute that real candidate ID:

```http
GET /candidates-fsb-enriched/_doc/REPLACE_WITH_CONTACT_ID
```

Inspect `_source.systems`, `_source.skills`, `_source.searchText`, and whether
`_source.embedding` exists. This distinguishes an absent/unembedded document from
a ranking issue. Compare the candidate's source tags before changing relevance
weights. Do not paste the entire vector array when sharing diagnostics.

## 7. Grow progressively

Use **Resume fetch** for one or more additional batches, then select only those
new files under **Embed & index**. Keep the same dataset, scope, and destination
index. Re-embedding a file updates the same Salesforce IDs; it is not a deletion
of other documents. Avoid mixing older exports into this new index.

Separate employment/education history objects are still pending verified schema
details. Current enrichment covers the confirmed Contact/tag/employer relationships
and Contact-level education fields. The automated tests use offline fixtures;
this fresh sandbox run is the live data-quality and relevance test.
