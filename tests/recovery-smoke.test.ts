// Added during recovery; these tests are not transcribed original source.
// All adapters use local doubles. No Salesforce/OpenSearch connection or model download.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Candidate } from "../domain/entities/Candidate";
import { CandidateDocument } from "../domain/entities/CandidateDocument";
import { DocumentIndex } from "../application/ports/DocumentIndex";
import { FullIndexCandidates } from "../application/usecases/FullIndexCandidates";
import { IndexCandidates } from "../application/usecases/IndexCandidates";
import { TemplateProfileGenerator } from "../domain/services/TemplateProfileGenerator";
import { CandidateMapper } from "../infrastructure/salesforce/mappers/CandidateMapper";
import type { OpenSearchClient } from "../infrastructure/opensearch/OpenSearchClient";

// Replace even inherited credentials: validation must never target a live endpoint.
process.env.OPENSEARCH_NODE = "http://127.0.0.1:1";
process.env.OPENSEARCH_USERNAME = "recovery-test";
process.env.OPENSEARCH_PASSWORD = "recovery-test";
process.env.OPENSEARCH_INDEX = "recovery-test-candidates";
process.env.OPENSEARCH_SEARCH_PIPELINE = "recovery-test-pipeline";

const recoveredAdapters = Promise.all([
  import("../infrastructure/opensearch/OpenSearchDocumentMapper"),
  import("../infrastructure/opensearch/OpenSearchDocumentIndex"),
  import("../infrastructure/opensearch/OpenSearchHybridSearch"),
]);

const candidateFixture = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: "003000000000001",
  name: "Recovered Candidate",
  title: undefined,
  company: undefined,
  location: undefined,
  salary: undefined,
  skills: [],
  skillCategories: [],
  systems: [],
  industries: [],
  subIndustries: [],
  jobFunctions: [],
  languages: [],
  ...overrides,
});

const documentFixture = (): CandidateDocument => ({
  salesforceId: "003000000000001",
  candidate: candidateFixture({ skills: ["TypeScript"], languages: [{ code: "EN", level: "Fluent" }] }),
  profile: "Recovered profile",
  embedding: Array(768).fill(0.125),
  indexedAt: new Date("2026-10-23T00:00:00.000Z"),
});

function recordingDocumentIndex() {
  const documents: CandidateDocument[] = [];
  let initialized = 0;
  const index: DocumentIndex = {
    initialize: async () => { initialized++; },
    index: async (document) => { documents.push(document); },
    indexMany: async (batch) => { documents.push(...batch); },
    findById: async (id) => documents.find((document) => document.salesforceId === id) ?? null,
  };
  return { index, documents, initializationCount: () => initialized };
}

test("Salesforce fields survive the candidate/document round trip", async () => {
  const [{ OpenSearchDocumentMapper }] = await recoveredAdapters;
  const candidate = CandidateMapper.fromContact({
    Id: "003000000000001",
    Name: "Recovered Candidate",
    Current_Position__c: "Engineer",
    Current_Company__c: "Example",
    Current_Salary__c: 100,
    TagConnector__r: {
      SkillCode1__c: "TypeScript", SkillCode2__c: " ", SkillCode3__c: null,
      Systems1__c: "OpenSearch", Industry__c: "Technology", JobFunction1__c: "Development",
    },
  });
  assert.deepEqual(candidate.skills, ["TypeScript"]);
  assert.deepEqual(candidate.systems, ["OpenSearch"]);
  const document = { ...documentFixture(), candidate };
  assert.deepEqual(
    OpenSearchDocumentMapper.fromDocument(OpenSearchDocumentMapper.toDocument(document)),
    document,
  );
});

test("empty candidates do not acquire invented profile expertise", () => {
  const generator = new TemplateProfileGenerator();
  const candidate = candidateFixture();
  assert.equal(generator.generate(candidate), "Candidate Recovered Candidate.");
  assert.equal(generator.generateEmbeddingText(candidate), "");
});

test("full indexing skips empty candidates and embeds expertise without personal identity", async () => {
  const candidate = candidateFixture({ title: "Engineer", skills: ["TypeScript"], salary: 100, location: "Tokyo" });
  const recording = recordingDocumentIndex();
  const embeddedTexts: string[] = [];
  await new FullIndexCandidates(
    { getAll: async () => [candidate, candidateFixture({ id: "empty" })], getByIds: async () => [] },
    new TemplateProfileGenerator(),
    {
      embedDocument: async (text) => { embeddedTexts.push(text); return Array(768).fill(0); },
      embedQuery: async () => { throw new Error("Query embedding must not be called during indexing"); },
    },
    recording.index,
  ).execute();
  assert.equal(recording.initializationCount(), 1);
  assert.equal(recording.documents.length, 1);
  assert.match(embeddedTexts[0], /TypeScript/);
  assert.doesNotMatch(embeddedTexts[0], /Recovered Candidate|Tokyo|100/);
  assert.equal(recording.documents[0].salesforceId, candidate.id);
});

test("partial indexing merges additional skills once and preserves candidate details", async () => {
  const candidate = candidateFixture({ skills: ["TypeScript"] });
  const recording = recordingDocumentIndex();
  const requestedIds: string[][] = [];
  await new IndexCandidates(
    {
      getAll: async () => { throw new Error("Partial indexing must not fetch every candidate"); },
      getByIds: async (ids) => { requestedIds.push(ids); return [candidate]; },
    },
    new TemplateProfileGenerator(),
    { embedDocument: async () => Array(768).fill(0), embedQuery: async () => [] },
    recording.index,
  ).execute([candidate.id], { [candidate.id]: ["TypeScript", "React"] });
  assert.deepEqual(requestedIds, [[candidate.id]]);
  assert.deepEqual(recording.documents[0].candidate.skills, ["TypeScript", "React"]);
  assert.match(recording.documents[0].profile, /TypeScript and React/);
});

test("wrong-sized document vectors fail before writing to the index", async () => {
  const recording = recordingDocumentIndex();
  const usecase = new FullIndexCandidates(
    { getAll: async () => [candidateFixture({ skills: ["TypeScript"] })], getByIds: async () => [] },
    new TemplateProfileGenerator(),
    { embedDocument: async () => Array(384).fill(0), embedQuery: async () => [] },
    recording.index,
  );
  await assert.rejects(usecase.execute(), /768-dimensional/);
  assert.equal(recording.documents.length, 0);
});

test("hybrid search sends lexical and vector queries together and restores domain results", async () => {
  const [{ OpenSearchDocumentMapper }, , { OpenSearchHybridSearch }] = await recoveredAdapters;
  const document = documentFixture();
  let request: any;
  const client = { connection: { search: async (input: any) => {
    request = input;
    return { body: { hits: { hits: [{ _score: 0.032, _source: OpenSearchDocumentMapper.toDocument(document) }] } } };
  } } } as unknown as OpenSearchClient;
  const search = new OpenSearchHybridSearch(client);
  const results = await search.search("TypeScript engineer", Array(768).fill(0), 10);
  assert.equal(request.search_pipeline, "recovery-test-pipeline");
  assert.equal(request.body.query.hybrid.queries[0].multi_match.query, "TypeScript engineer");
  assert.equal(request.body.query.hybrid.queries[1].knn.embedding.vector.length, 768);
  assert.equal(results[0].score, 0.032);
  assert.deepEqual(results[0].document, document);
  await assert.rejects(search.search("invalid", [0]), /768-dimensional/);
});

test("501 documents produce two bulk writes and one final refresh", async () => {
  const [, { OpenSearchDocumentIndex }] = await recoveredAdapters;
  const requests: any[] = [];
  let refreshes = 0;
  const client = { connection: {
    bulk: async (input: any) => { requests.push(input); return { body: { items: [] } }; },
    indices: { refresh: async () => { refreshes++; } },
  } } as unknown as OpenSearchClient;
  const documents = Array.from({ length: 501 }, (_, index) => ({ ...documentFixture(), salesforceId: String(index) }));
  await new OpenSearchDocumentIndex(client).indexMany(documents);
  assert.deepEqual(requests.map((request) => request.body.length), [1000, 2]);
  assert.equal(requests[1].body[0].index._id, "500");
  assert.equal(refreshes, 1);
});

test("bulk item errors propagate instead of reporting successful indexing", async () => {
  const [, { OpenSearchDocumentIndex }] = await recoveredAdapters;
  let refreshes = 0;
  const client = { connection: {
    bulk: async () => ({ body: { items: [{ index: { error: { reason: "incompatible vector" } } }] } }),
    indices: { refresh: async () => { refreshes++; } },
  } } as unknown as OpenSearchClient;
  await assert.rejects(new OpenSearchDocumentIndex(client).indexMany([documentFixture()]), /failed to index 1/);
  assert.equal(refreshes, 0);
});

test("initialization installs the pipeline and creates a 768-dimensional index", async () => {
  const [, { OpenSearchDocumentIndex }] = await recoveredAdapters;
  const calls: any[] = [];
  const client = { connection: {
    transport: { request: async (input: any) => { calls.push(input); } },
    indices: {
      exists: async () => ({ body: false }),
      create: async (input: any) => { calls.push(input); },
    },
  } } as unknown as OpenSearchClient;
  await new OpenSearchDocumentIndex(client).initialize();
  assert.equal(calls[0].path, "/_search/pipeline/recovery-test-pipeline");
  assert.equal(calls[1].body.mappings.properties.embedding.dimension, 768);
});

test("existing incompatible vector mappings stop initialization", async () => {
  const [, { OpenSearchDocumentIndex }] = await recoveredAdapters;
  const client = { connection: {
    transport: { request: async () => {} },
    indices: {
      exists: async () => ({ body: true }),
      getMapping: async () => ({ body: {
        "recovery-test-candidates": { mappings: { properties: { embedding: { type: "knn_vector", dimension: 384 } } } },
      } }),
      putMapping: async () => { throw new Error("Must not update incompatible mappings"); },
    },
  } } as unknown as OpenSearchClient;
  await assert.rejects(new OpenSearchDocumentIndex(client).initialize(), /incompatible embedding mapping/);
});
