import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "@opensearch-project/opensearch";
import { CandidateSearch } from "../application/ports/candidate-search";
import { OpenSearchConfig } from "../infrastructure/config/opensearch-config";
import { DUMMY_CANDIDATES } from "../infrastructure/dummy/dummy-candidates";
import { CANDIDATE_SEARCH_BENCHMARK_CASES } from "./candidate-search-benchmark-cases";

interface BenchmarkResult {
  id: string;
  category: string;
  mode: "lexical" | "semantic" | "hybrid";
  query: string;
  expectedId: string;
  requiredRank: number;
  actualRank: number | null;
  passed: boolean;
  hits: { id: string; score: number }[];
  elapsedMs: number;
  error?: string;
}

// Test-only evaluator: query judgments and reporting never enter runtime search.
export class CandidateSearchBenchmark {
  constructor(
    private readonly client: Client,
    private readonly config: OpenSearchConfig,
    private readonly search: CandidateSearch,
  ) {}

  async run(split: "development" | "validation" | "all") {
    const results: BenchmarkResult[] = [];
    const checks: Omit<BenchmarkResult, "actualRank" | "passed" | "hits" | "elapsedMs">[] = [];
    if (split !== "validation") {
      for (const candidate of DUMMY_CANDIDATES) {
        checks.push({ id: candidate.id, category: "exact-role", mode: "lexical", query: candidate.title!, expectedId: candidate.id, requiredRank: 1 });
        checks.push({ id: candidate.id, category: "role-and-skills", mode: "hybrid", query: [candidate.title, ...candidate.skills.slice(0, 2)].join(" "), expectedId: candidate.id, requiredRank: 1 });
      }
    }
    for (const item of CANDIDATE_SEARCH_BENCHMARK_CASES.filter((item) => split === "all" || item.split === split)) {
      checks.push({ ...item, category: item.split, mode: "hybrid", requiredRank: 1 });
      checks.push({ ...item, category: item.split, mode: "semantic", requiredRank: 5 });
    }
    for (const check of checks) {
      const started = Date.now();
      try {
        const hits = await this.query(check.mode, check.query);
        const position = hits.findIndex((hit) => hit.id === check.expectedId);
        results.push({ ...check, hits, actualRank: position < 0 ? null : position + 1,
          passed: position >= 0 && position < check.requiredRank, elapsedMs: Date.now() - started });
      } catch (error) {
        results.push({ ...check, hits: [], actualRank: null, passed: false, elapsedMs: Date.now() - started,
          error: error instanceof Error ? error.message : String(error) });
      }
      const result = results.at(-1)!;
      if (!result.passed) console.log(`FAIL: ${check.mode} ${check.id}, expected ${check.expectedId} at rank <= ${check.requiredRank}, got ${result.actualRank ?? "absent"}; first=${result.hits[0]?.id ?? result.error}`);
      if (results.length % 20 === 0 || results.length === checks.length) console.log(`Benchmark progress: ${results.length}/${checks.length}, failures=${results.filter((item) => !item.passed).length}`);
    }
    const groups = [...new Set(results.map((item) => `${item.category}/${item.mode}`))].map((name) => {
      const rows = results.filter((item) => `${item.category}/${item.mode}` === name);
      return { name, count: rows.length, passed: rows.filter((item) => item.passed).length,
        top1Accuracy: rows.filter((item) => item.actualRank === 1).length / rows.length,
        recallAt5: rows.filter((item) => item.actualRank !== null && item.actualRank <= 5).length / rows.length,
        mrrAt10: rows.reduce((total, item) => total + (item.actualRank ? 1 / item.actualRank : 0), 0) / rows.length };
    });
    const report = {
      generatedAt: new Date().toISOString(), index: this.config.OPENSEARCH_INDEX, modelId: this.config.OPENSEARCH_MODEL_ID,
      split, candidateCount: DUMMY_CANDIDATES.length,
      candidateHash: createHash("sha256").update(JSON.stringify(DUMMY_CANDIDATES)).digest("hex"),
      caseHash: createHash("sha256").update(JSON.stringify(CANDIDATE_SEARCH_BENCHMARK_CASES)).digest("hex"),
      searchCodeHash: createHash("sha256").update(await readFile(join(__dirname, "../infrastructure/opensearch/open-search-hybrid-search.ts"))).digest("hex"),
      searchPipeline: (await this.client.transport.request({
        method: "GET", path: "/_search/pipeline/" + this.config.OPENSEARCH_SEARCH_PIPELINE,
      })).body,
      total: results.length, passed: results.filter((item) => item.passed).length, groups, results,
    };
    const directory = join(process.cwd(), ".cache", "search-benchmarks");
    await mkdir(directory, { recursive: true });
    const reportPath = join(directory, report.generatedAt.replace(/[:.]/g, "-") + "-" + split + ".json");
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(groups, null, 2));
    console.log(`Benchmark: ${report.passed}/${report.total} checks passed. Report: ${reportPath}`);
    return report;
  }

  private async query(mode: BenchmarkResult["mode"], query: string) {
    if (mode === "hybrid") {
      return (await this.search.search(query, 10)).map((hit) => ({ id: hit.document.salesforceId, score: hit.score }));
    }
    const response = await this.client.search({ index: this.config.OPENSEARCH_INDEX, allow_partial_search_results: false, body: {
      size: 10, _source: false,
      query: mode === "lexical" ? { match_phrase: { title: query } } : {
        neural: { embedding: { query_text: query, model_id: this.config.OPENSEARCH_MODEL_ID, k: 100 } },
      },
    } });
    if (response.body.timed_out || (response.body._shards?.failed ?? 0) > 0) throw new Error("Benchmark query returned partial results");
    return response.body.hits.hits.map((hit) => ({ id: hit._id!, score: hit._score ?? 0 }));
  }
}
