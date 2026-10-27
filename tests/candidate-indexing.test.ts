import assert from "node:assert/strict";
import { test } from "node:test";
import { IndexCandidates } from "../application/usecases/index-candidates";
import { SearchCandidates } from "../application/usecases/search-candidates";
import { CandidateDocumentFactory } from "../application/services/candidate-document-factory";
import { TemplateCandidateProfileGenerator } from "../application/services/template-candidate-profile-generator";
import { SalesforceCandidateCoreMapper } from "../infrastructure/salesforce/mappers/salesforce-candidate-core-mapper";
import { OpenSearchCandidateDocumentMapper } from "../infrastructure/opensearch/open-search-candidate-document-mapper";
import { candidateFixture, documentFixture, recordingDocumentIndex } from "./candidate-fixtures";

const generator = new TemplateCandidateProfileGenerator();
const factory = new CandidateDocumentFactory(generator);

test("Salesforce candidate fields survive the document round trip without vectors", () => {
  const candidate = SalesforceCandidateCoreMapper.fromRecord({
    Id: "003000000000001", Name: "Recovered Candidate", Title: "Engineer",
    Account: { Name: "Example" }, currentSalary__c: 100,
    TagConnector__r: { SkillCode1__c: "TypeScript", SkillCode2__c: " ", Systems1__c: "OpenSearch" },
  }, [], []).candidate;
  const document = { ...documentFixture(), candidate };
  const source = OpenSearchCandidateDocumentMapper.toDocument(document);
  assert.deepEqual(candidate.skills, [], "Expertise is supplied by the association enrichment step");
  assert.equal(candidate.title, "Engineer");
  assert.equal(candidate.company, undefined, "Employer is supplied by the account join");
  assert.equal(candidate.salary, 100);
  assert.match(factory.create(candidate)!.searchText, /^Role: Engineer/m);
  assert.equal("embedding" in source, false);
  assert.deepEqual(OpenSearchCandidateDocumentMapper.fromDocument(source), document);
  assert.deepEqual(OpenSearchCandidateDocumentMapper.fromDocument({ ...source, embedding: [1, 2] }), document);
});

test("Salesforce contacts without an Account retain their zero salary", () => {
  const candidate = SalesforceCandidateCoreMapper.fromRecord({
    Id: "003000000000001", Name: "Candidate", Account: null, currentSalary__c: 0,
  }, [], []).candidate;
  assert.equal(candidate.company, undefined);
  assert.equal(candidate.salary, 0);
});

test("search text contains expertise and excludes identity, salary and location", () => {
  const candidate = candidateFixture({ title: "Engineer", skills: ["TypeScript"], location: "Tokyo", salary: 100 });
  const document = factory.create(candidate)!;
  assert.match(document.searchText, /TypeScript/);
  assert.doesNotMatch(document.searchText, /Recovered Candidate|Tokyo|100/);
  assert.match(document.profile, /Tokyo/);
  assert.equal(generator.generate(candidateFixture()), "Candidate Recovered Candidate.");
  assert.equal(factory.create(candidateFixture()), null);
});

test("full indexing submits all searchable candidates in bounded batches", async () => {
  const recording = recordingDocumentIndex();
  const candidates = Array.from({ length: 205 }, (_, i) => candidateFixture({
    id: String(i), skills: ["TypeScript"],
  }));
  candidates.push(candidateFixture());
  const result = await new IndexCandidates(
    { getAll: async () => candidates, getByIds: async () => [] }, factory, recording.index,
  ).execute();
  assert.deepEqual(result, { indexed: 205, skipped: 1 });
  assert.deepEqual(recording.batches, [100, 100, 5]);
  assert.equal(recording.documents.length, 205);
  assert.ok(recording.documents.every((document) => !("embedding" in document)));
});

test("selected indexing deduplicates IDs and skills without mutating source candidates", async () => {
  const candidate = candidateFixture({ skills: ["TypeScript", "React", "TypeScript"] });
  const recording = recordingDocumentIndex();
  const requested: string[][] = [];
  const usecase = new IndexCandidates({
    getAll: async () => { throw new Error("Unexpected full fetch"); },
    getByIds: async (ids) => { requested.push(ids); return [candidate]; },
  }, factory, recording.index);
  assert.deepEqual(await usecase.execute([candidate.id, candidate.id]), { indexed: 1, skipped: 0 });
  assert.deepEqual(requested, [[candidate.id]]);
  assert.deepEqual(recording.documents[0].candidate.skills, ["TypeScript", "React"]);
  assert.deepEqual(candidate.skills, ["TypeScript", "React", "TypeScript"]);
  assert.match(recording.documents[0].profile, /TypeScript and React/);
  assert.deepEqual(await usecase.execute([]), { indexed: 0, skipped: 0 });
  assert.equal(requested.length, 1);
});

test("selected indexing batches large selections and skips unsearchable candidates", async () => {
  const candidates = Array.from({ length: 205 }, (_, i) => candidateFixture({ id: String(i), skills: ["Java"] }));
  candidates.push(candidateFixture({ id: "empty" }));
  const recording = recordingDocumentIndex();
  const usecase = new IndexCandidates({
    getAll: async () => { throw new Error("Unexpected full fetch"); },
    getByIds: async () => candidates,
  }, factory, recording.index);
  assert.deepEqual(await usecase.execute(candidates.map((candidate) => candidate.id)), { indexed: 205, skipped: 1 });
  assert.deepEqual(recording.batches, [100, 100, 5]);
});

test("search validates input and delegates plain text through its port", async () => {
  const calls: unknown[] = [];
  const result = [{ score: 0.75, document: documentFixture() }];
  const search = new SearchCandidates({ search: async (...args) => { calls.push(args); return result; } });
  assert.deepEqual(await search.execute(" TypeScript engineer ", 5), result);
  assert.deepEqual(calls, [["TypeScript engineer", 5]]);
  await assert.rejects(search.execute("   "));
  await assert.rejects(search.execute("Engineer", 0));
  await assert.rejects(search.execute("Engineer", 101));
  assert.equal(calls.length, 1);
});

test("stopping indexing finishes the current bulk batch and does not start the next", async () => {
  const controller = new AbortController(); const batches: number[] = [];
  const candidates = Array.from({ length: 250 }, (_, index) => candidateFixture({ id: String(index), skills: ["Java"] }));
  const indexer = new IndexCandidates({ getAll: async () => candidates, getByIds: async () => [] }, factory, {
    indexMany: async (documents) => { batches.push(documents.length); controller.abort(); },
  });
  await assert.rejects(indexer.execute(undefined, undefined, controller.signal), /stopped after/);
  assert.deepEqual(batches, [100]);
});
