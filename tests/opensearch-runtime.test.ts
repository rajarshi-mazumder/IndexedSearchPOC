import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@opensearch-project/opensearch";
import { CandidateOpenSearchDocumentRepository as OpenSearchCandidateDocumentIndex } from "../backend/dataEmbedding/indexing/infrastructure/repositories/candidateOpenSearchDocumentRepository";
import { OpenSearchCandidateDocumentMapper } from "../backend/candidateData/mappers/openSearchCandidateDocumentMapper";
import { SearchOpenSearchCandidatesTestDriver as OpenSearchHybridSearch } from "./support/searchOpenSearchCandidatesTestDriver";
import { config, documentFixture } from "./candidate-fixtures";

test("enriched documents reject an old index before bulk writes and verify compatible mapping once", async () => {
  let version = 2; let reads = 0; let writes = 0;
  const client = { indices: { getMapping: async () => {
    reads++; return { body: { [config.OPENSEARCH_INDEX]: { mappings: { _meta: { schema_version: version }, properties: { enrichment: { type: "object", enabled: false } } } } } };
  } }, bulk: async (request: { body: unknown[] }) => { writes++; return acceptedBulk(request.body); } } as unknown as Client;
  const document = documentFixture();
  document.candidate.enrichment = { version: 2, details: {}, associations: [], tags: [], warnings: [] };
  const index = new OpenSearchCandidateDocumentIndex(client, config);
  await assert.rejects(index.indexMany([document]), /Enriched candidates require a new index/);
  assert.equal(writes, 0);
  version = 3;
  await index.indexMany([document]); await index.indexMany([document]);
  assert.equal(writes, 2); assert.equal(reads, 2);
});

function acceptedBulk(body: unknown[]) {
  return { body: { errors: false, items: Array.from({ length: body.length / 2 }, () => ({ index: { status: 200 } })) } };
}

test("stale CV deletion is idempotent, retries throttling and fails on missing acknowledgements", async () => {
  const requests: any[] = [];
  const client = { bulk: async (request: any) => {
    requests.push(request);
    return { body: { items: requests.length === 1 ? [{ delete: { status: 404 } }, { delete: { status: 429 } }]
      : [{ delete: { status: 200 } }] } };
  } } as unknown as Client;
  await new OpenSearchCandidateDocumentIndex(client, config, async () => {}).removeMany(["missing", "retry"]);
  assert.equal(requests.length, 2); assert.equal(requests[1].body[0].delete._id, "retry");
  assert.equal(requests[1].pipeline, undefined);
  assert.equal(requests[1].body[0].delete._index, config.OPENSEARCH_INDEX);
  await assert.rejects(new OpenSearchCandidateDocumentIndex({ bulk: async () => ({ body: { items: [] } }) } as unknown as Client, config).removeMany(["a"]), /incomplete/);
  await assert.rejects(new OpenSearchCandidateDocumentIndex({ bulk: async () => ({ body: { items: [{ delete: { status: 403 } }] } }) } as unknown as Client, config).removeMany(["a"]), /Could not remove/);
});

test("bulk indexing uses stable IDs and the embedding pipeline, without refreshing or setting up", async () => {
  const requests: any[] = [];
  const client = { bulk: async (input: any) => { requests.push(input); return acceptedBulk(input.body); } } as unknown as Client;
  const documents = Array.from({ length: 201 }, (_, i) => ({ ...documentFixture(), salesforceId: String(i) }));
  await new OpenSearchCandidateDocumentIndex(client, config).indexMany(documents);
  assert.deepEqual(requests.map((request) => request.body.length), [200, 200, 2]);
  assert.equal(requests[2].body[0].index._id, "200");
  assert.ok(requests.every((request) => request.pipeline === config.OPENSEARCH_INGEST_PIPELINE && !("refresh" in request)));
  assert.equal(requests[0].body[1].searchText, "Skills: TypeScript");
  assert.equal("embedding" in requests[0].body[1], false);
  await new OpenSearchCandidateDocumentIndex(client, config).indexMany([]);
  assert.equal(requests.length, 3);
});

test("bulk retries only throttled documents, not previously successful ones", async () => {
  const requests: any[] = [];
  const waits: number[] = [];
  const client = { bulk: async (input: any) => {
    requests.push(input);
    return requests.length === 1 ? { body: { errors: true, items: [
      { index: { status: 200 } }, { index: { status: 429, error: { reason: "throttled" } } },
    ] } } : acceptedBulk(input.body);
  } } as unknown as Client;
  await new OpenSearchCandidateDocumentIndex(client, config, async (ms) => { waits.push(ms); }).indexMany([
    documentFixture(), { ...documentFixture(), salesforceId: "second" },
  ]);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].body.length, 2);
  assert.equal(requests[1].body[0].index._id, "second");
  assert.deepEqual(waits, [1000]);
});

test("permanent embedding failures and exhausted throttling fail indexing", async () => {
  for (const status of [400, 429]) {
    let calls = 0;
    const client = { bulk: async () => {
      calls++;
      return { body: { errors: true, items: [{ index: { status, error: { reason: "model failed" } } }] } };
    } } as unknown as Client;
    await assert.rejects(new OpenSearchCandidateDocumentIndex(client, config, async () => {}).indexMany([documentFixture()]), /model failed/);
    assert.equal(calls, status === 400 ? 1 : 4);
  }
});

test("missing bulk acknowledgements fail indexing", async () => {
  const client = { bulk: async () => ({ body: { errors: false, items: [] } }) } as unknown as Client;
  await assert.rejects(new OpenSearchCandidateDocumentIndex(client, config).indexMany([documentFixture()]), /incomplete bulk/);
});

test("independent searches bypass pipelines, preserve raw scores and rank locally", async () => {
  const requests: any[] = [];
  const document = documentFixture();
  const client = { search: async (input: any) => {
    requests.push(input);
    return { body: { timed_out: false, hits: { hits: [{ _score: 0.8, _source: OpenSearchCandidateDocumentMapper.toDocument(document) }] } } };
  } } as unknown as Client;
  const results = await new OpenSearchHybridSearch(client, config).search("TypeScript engineer", 10);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.index, config.OPENSEARCH_INDEX);
    assert.equal(request.search_pipeline, "_none");
    assert.equal(request.body.size, 50);
    assert.equal(request.allow_partial_search_results, false);
    assert.deepEqual(request.body._source, { excludes: ["embedding"] });
    assert.equal(request.body.query.hybrid, undefined);
  }
  assert.equal(requests[0].body.query.multi_match.query, "TypeScript engineer");
  assert.deepEqual(requests[1].body.query.neural.embedding, {
    query_text: "TypeScript engineer", model_id: config.OPENSEARCH_MODEL_ID, k: 50,
  });
  assert.deepEqual(results, [{ score: 2 / 61, rankingMethod: "rrf", lexicalScore: 0.8, vectorScore: 0.8,
    lexicalRank: 1, vectorRank: 1, document }]);
});

test("search refuses timed out or partially failed results", async () => {
  for (const failure of [{ timed_out: true }, { _shards: { failed: 1 } }]) {
    const client = { search: async () => ({ body: { ...failure, hits: { hits: [] } } }) } as unknown as Client;
    await assert.rejects(new OpenSearchHybridSearch(client, config).search("engineer", 10), /partial results/);
  }
});
