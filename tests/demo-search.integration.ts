// Explicit live AWS verification. --reindex also exercises the real indexing CLI.
import "dotenv/config";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify, parseArgs } from "node:util";
import { setTimeout } from "node:timers/promises";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { z } from "zod";
import { loadOpenSearchConfig } from "../infrastructure/config/opensearch-config";
import { OpenSearchServerlessClient } from "../infrastructure/opensearch/open-search-serverless-client";
import { OpenSearchHybridSearch } from "../infrastructure/opensearch/open-search-hybrid-search";
import { SearchCandidates } from "../application/usecases/search-candidates";
import { DUMMY_CANDIDATES } from "../infrastructure/dummy/dummy-candidates";
import { TITAN_DIMENSIONS } from "../infrastructure/opensearch/titan-embedding-config";
import { OpenSearchCandidateDocumentMapper } from "../infrastructure/opensearch/open-search-candidate-document-mapper";
import { TemplateCandidateProfileGenerator } from "../application/services/template-candidate-profile-generator";
import { CandidateSearchBenchmark } from "./candidate-search-benchmark";

const runFile = promisify(execFile);
const storedCandidateSchema = z.object({
  salesforceId: z.string(),
  indexedAt: z.string().datetime(),
  embedding: z.array(z.number().finite()).length(TITAN_DIMENSIONS)
    .refine((values) => values.some((value) => value !== 0), "Embedding must be nonzero"),
}).passthrough();

async function runDemoIndexing(ids: string[] = []) {
  const { stdout } = await runFile(process.execPath, [
    "--import", "tsx", resolve(__dirname, "../presentation/cli/index-candidates.ts"), "--source", "dummy", ...ids,
  ], { timeout: 300000, windowsHide: true });
  console.log(stdout.trim());
}

async function main() {
  const { values } = parseArgs({ options: {
    reindex: { type: "boolean", default: false },
    "benchmark-split": { type: "string", default: "all" },
  } });
  const benchmarkSplit = z.enum(["development", "validation", "all"]).parse(values["benchmark-split"]);
  const config = loadOpenSearchConfig(process.env);
  assert.ok(config.OPENSEARCH_INDEX.includes("demo"), "Live demo checks require a dedicated index with 'demo' in its name");
  const client = new OpenSearchServerlessClient(config, defaultProvider()).connection;
  try {
    async function readCandidates() {
      const response = await client.search({ index: config.OPENSEARCH_INDEX, allow_partial_search_results: false, body: {
        size: DUMMY_CANDIDATES.length, _source: true, query: { ids: { values: DUMMY_CANDIDATES.map((candidate) => candidate.id) } },
      } });
      assert.ok(!response.body.timed_out && !(response.body._shards?.failed), "Document inspection must complete");
      return response.body.hits.hits.map((hit) => {
        const source = storedCandidateSchema.parse(hit._source);
        assert.equal(hit._id, source.salesforceId, "Candidate IDs must be stable OpenSearch document IDs");
        return source;
      });
    }

    async function waitForCandidates(updatedIds: string[], since: number) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const sources = await readCandidates();
        if (sources.length === DUMMY_CANDIDATES.length && updatedIds.every((id) =>
          sources.some((source) => source.salesforceId === id && Date.parse(source.indexedAt) >= since))) return sources;
        await setTimeout(5000);
      }
      throw new Error("Fresh candidate documents did not become visible within the polling window");
    }

    const startedAt = Date.now();
    if (values.reindex) await runDemoIndexing();
    const sources = await waitForCandidates(values.reindex ? DUMMY_CANDIDATES.map((candidate) => candidate.id) : [], startedAt);
    const generator = new TemplateCandidateProfileGenerator();
    for (const candidate of DUMMY_CANDIDATES) {
      const source = sources.find((source) => source.salesforceId === candidate.id)!;
      const document = OpenSearchCandidateDocumentMapper.fromDocument(source);
      assert.deepEqual(document.candidate, candidate, "Stored DTO must match the source: " + candidate.id);
      assert.equal(document.searchText, generator.generateSearchText(candidate));
      assert.equal(document.profile, generator.generate(candidate));
    }
    assert.equal((await client.count({ index: config.OPENSEARCH_INDEX })).body.count, DUMMY_CANDIDATES.length,
      "The dedicated demo index must contain exactly the fixture dataset, with no duplicates or stale extras");
    console.log(`PASS: ${DUMMY_CANDIDATES.length} complete candidate records contain the expected embedding input and finite, nonzero 1024-dimensional vectors` +
      (values.reindex ? "; all records were freshly indexed." : "."));

    if (values.reindex) {
      const countBefore = (await client.count({ index: config.OPENSEARCH_INDEX })).body.count;
      const selectedIds = ["demo-java-platform", "demo-react-frontend"];
      const selectedAt = Date.now();
      await runDemoIndexing([...selectedIds, selectedIds[0]]);
      const updated = await waitForCandidates(selectedIds, selectedAt);
      assert.equal((await client.count({ index: config.OPENSEARCH_INDEX })).body.count, countBefore, "Reindex must not create duplicate documents");
      for (const previous of sources.filter((source) => !selectedIds.includes(source.salesforceId))) {
        assert.deepEqual(updated.find((source) => source.salesforceId === previous.salesforceId), previous,
          "Selected indexing must leave other candidates untouched");
      }
      console.log(`PASS: selected IDs updated through the CLI without duplicates or changes to the other ${DUMMY_CANDIDATES.length - selectedIds.length} candidates.`);
    }

    const lexical = await client.search({ index: config.OPENSEARCH_INDEX, body: {
      size: 5, _source: ["name", "salesforceId"], query: { match: { skills: "Kafka" } },
    } });
    assert.equal(lexical.body.hits.hits[0]?._id, "demo-java-platform");
    console.log("PASS: lexical Kafka query ranks Alex Demo first.");

    const semantic = await client.search({ index: config.OPENSEARCH_INDEX, body: {
      size: 5, _source: ["name", "salesforceId"], query: { neural: { embedding: {
        query_text: "an engineer who keeps production services running, monitors outages, and restores availability",
        model_id: config.OPENSEARCH_MODEL_ID, k: DUMMY_CANDIDATES.length,
      } } },
    } });
    assert.ok(semantic.body.hits.hits.some((hit) => hit._id === "demo-site-reliability"));
    console.log("PASS: semantic query finds the Site Reliability Engineer in the top five.");

    const search = new SearchCandidates(new OpenSearchHybridSearch(client, config));
    for (const [query, expectedId] of [
      ["Java Spring Boot Kafka microservices", "demo-java-platform"],
      ["React TypeScript accessible web interfaces", "demo-react-frontend"],
      ["budget forecasts financial modeling", "demo-financial-analyst"],
    ]) {
      const results = await search.execute(query, 5);
      assert.ok(results.some((result) => result.document.salesforceId === expectedId), "Expected demo candidate for: " + query);
      console.log("PASS: hybrid query " + JSON.stringify(query) + " -> " + results.map((result) => result.document.candidate.name).join(", "));
    }
    const { stdout } = await runFile(process.execPath, [
      "--import", "tsx", resolve(__dirname, "../presentation/cli/search.ts"), "Java Spring Boot Kafka microservices",
    ], { timeout: 180000, windowsHide: true });
    assert.match(stdout, /#1\s+Hybrid Score: [\d.]+\s+Name: Alex Demo/);
    console.log("PASS: the search CLI displays Alex Demo as the first Java/Kafka result.");
    const report = await new CandidateSearchBenchmark(client, config, new OpenSearchHybridSearch(client, config)).run(benchmarkSplit);
    assert.equal(report.passed, report.total, "Relevance benchmark failures; inspect the saved report before changing ranking");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Live demo verification failed");
  process.exitCode = 1;
});
