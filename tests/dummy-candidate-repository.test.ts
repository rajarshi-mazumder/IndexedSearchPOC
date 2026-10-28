import assert from "node:assert/strict";
import { test } from "node:test";
import { DummyCandidateRepository } from "../backend/dataPreparation/infrastructure/repositories/dummyCandidateRepository";
import { DUMMY_CANDIDATES } from "../backend/dataPreparation/infrastructure/fixtures/dummyCandidates";
import { PrepareCandidateDocumentTestDriver as CandidateDocumentFactory } from "./support/prepareCandidateDocumentTestDriver";
import { GenerateCandidateProfileTestDriver as TemplateCandidateProfileGenerator } from "./support/generateCandidateProfileTestDriver";
import { EmbedCandidatesTestDriver as IndexCandidates } from "./support/embedCandidatesTestDriver";
import { recordingDocumentIndex } from "./candidate-fixtures";
import { CANDIDATE_SEARCH_BENCHMARK_CASES } from "./candidate-search-benchmark-cases";

test("all 100 fictional DTOs use the existing indexing flow without Salesforce", async () => {
  const repository = new DummyCandidateRepository(DUMMY_CANDIDATES);
  const recording = recordingDocumentIndex();
  const factory = new CandidateDocumentFactory(new TemplateCandidateProfileGenerator());
  assert.equal(new Set(DUMMY_CANDIDATES.map((candidate) => candidate.id)).size, 100);
  assert.equal(DUMMY_CANDIDATES.length, 100);
  assert.ok(new Set(DUMMY_CANDIDATES.flatMap((candidate) => candidate.industries)).size >= 30);
  assert.deepEqual(await new IndexCandidates(repository, factory, recording.index).execute(), {
    indexed: 100, skipped: 0,
  });
  assert.ok(recording.documents.every((document) => document.searchText.length > 0 && !("embedding" in document)));
  assert.ok(recording.documents.every((document) => typeof document.candidate.salary === "number"));
  const bilingual = recording.documents.find((document) => document.salesforceId === "demo-bilingual-pm")!;
  assert.deepEqual(bilingual.candidate.languages, [{ code: "JP", level: "Native" }, { code: "EN", level: "Fluent" }]);
});

test("fixed relevance judgments reference real candidates and separate development from validation", () => {
  const candidateIds = new Set(DUMMY_CANDIDATES.map((candidate) => candidate.id));
  assert.equal(CANDIDATE_SEARCH_BENCHMARK_CASES.length, 40);
  assert.equal(new Set(CANDIDATE_SEARCH_BENCHMARK_CASES.map((item) => item.id)).size, 40);
  assert.equal(new Set(CANDIDATE_SEARCH_BENCHMARK_CASES.map((item) => item.query)).size, 40);
  for (const item of CANDIDATE_SEARCH_BENCHMARK_CASES) assert.ok(candidateIds.has(item.expectedId), item.id);
  assert.equal(CANDIDATE_SEARCH_BENCHMARK_CASES.filter((item) => item.split === "development").length, 20);
  assert.equal(CANDIDATE_SEARCH_BENCHMARK_CASES.filter((item) => item.split === "validation").length, 20);
});

test("dummy repository selects IDs and keeps fixtures isolated from caller mutations", async () => {
  const repository = new DummyCandidateRepository(DUMMY_CANDIDATES);
  const selected = await repository.getByIds(["demo-java-platform", "does-not-exist"]);
  assert.equal(selected.length, 1);
  selected[0].skills.push("Temporary test skill");
  assert.ok(!(await repository.getAll())[0].skills.includes("Temporary test skill"));
  assert.deepEqual(await repository.getByIds([]), []);
});
