import assert from "node:assert/strict";
import { test } from "node:test";
import { CandidateSearchHit } from "../backend/dataSearch/application/models/candidateSearchHit";
import { RankCandidatesByReciprocalRankService } from "../backend/dataSearch/application/services/rankCandidatesByReciprocalRankService";
import { SearchCandidatesUseCase } from "../backend/dataSearch/application/useCases/searchCandidatesUseCase";
import { documentFixture } from "./candidate-fixtures";

function hit(id: string, score: number | null): CandidateSearchHit {
  const document = documentFixture();
  document.salesforceId = id;
  document.candidate.id = id;
  return { score, document };
}

test("RRF merges overlap, preserves raw scores and favors agreement over a single-branch winner", () => {
  const lexical = [hit("lexical-only", 120), hit("shared", 9)];
  const vector = [hit("vector-only", 0.99), hit("shared", 0.81)];
  const before = structuredClone({ lexical, vector });
  const results = new RankCandidatesByReciprocalRankService().rank(lexical, vector, 10);
  assert.deepEqual(results.map((result) => result.document.salesforceId), ["shared", "lexical-only", "vector-only"]);
  assert.deepEqual(results[0], { score: 2 / 62, rankingMethod: "rrf", lexicalScore: 9,
    vectorScore: 0.81, lexicalRank: 2, vectorRank: 2, document: lexical[1].document });
  assert.equal(results[1].score, 1 / 61);
  assert.equal(results[1].vectorScore, null);
  assert.equal(results[1].vectorRank, null);
  assert.equal(results[2].lexicalRank, null);
  assert.deepEqual({ lexical, vector }, before, "Ranking must not mutate repository results");
});

test("RRF applies the final limit after merging and uses candidate ID to break ties", () => {
  const ranker = new RankCandidatesByReciprocalRankService();
  const results = ranker.rank([hit("b", 50), hit("a", 49)], [hit("a", 0.9), hit("b", 0.8)], 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].document.salesforceId, "a");
  assert.equal(results[0].score, 1 / 61 + 1 / 62);
});

test("RRF handles empty branches, zero and unavailable scores without inventing evidence", () => {
  const ranker = new RankCandidatesByReciprocalRankService();
  assert.deepEqual(ranker.rank([], [], 10), []);
  const results = ranker.rank([], [hit("zero", 0), hit("unavailable", null)], 10);
  assert.equal(results[0].vectorScore, 0);
  assert.equal(results[0].lexicalRank, null);
  assert.equal(results[1].vectorScore, null);
  assert.equal(results[1].vectorRank, 2);
  assert.equal(results[1].score, 1 / 62);
});

test("repeated IDs within a branch contribute only once", () => {
  const results = new RankCandidatesByReciprocalRankService().rank([hit("a", 8), hit("a", 7)], [], 10);
  assert.equal(results.length, 1);
  assert.equal(results[0].score, 1 / 61);
  assert.equal(results[0].lexicalScore, 8);
});

test("search starts both branches concurrently and does not rank a partial result", async () => {
  let rejectLexical!: (error: Error) => void;
  let vectorStarted = false;
  let ranked = false;
  const search = new SearchCandidatesUseCase({
    searchLexical: async () => new Promise<CandidateSearchHit[]>((resolve, reject) => { rejectLexical = reject; }),
    searchVector: async () => { vectorStarted = true; return [hit("a", 0.9)]; },
  }, { rank: () => { ranked = true; return []; } });
  const pending = search.execute("Java", 10);
  assert.equal(vectorStarted, true);
  rejectLexical(new Error("Lexical search unavailable"));
  await assert.rejects(pending, /Lexical search unavailable/);
  assert.equal(ranked, false);
});

test("retrieval pools scale with requested results and stay bounded", async () => {
  const pools: number[] = [];
  const search = new SearchCandidatesUseCase({
    searchLexical: async (query, size) => { pools.push(size); return []; },
    searchVector: async (query, size) => { pools.push(size); return []; },
  }, new RankCandidatesByReciprocalRankService());
  await search.execute("Java", 100);
  assert.deepEqual(pools, [300, 300]);
});
