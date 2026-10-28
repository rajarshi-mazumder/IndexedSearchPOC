import assert from "node:assert/strict";
import { OfflineContractHarness } from "../support/offline-contract-harness";

/** Public API/CLI acceptance scenario. No imports from application internals. */
export async function currentSystemScenario(): Promise<Record<string, string>> {
  const h = await OfflineContractHarness.create();
  const files = ["batch-000001.json", "batch-000002.json", "batch-000003.json"];
  const directory = ".cache/candidates/contract/";
  const fetchRequest = { kind: "fetch", batchSize: 3, maxBatches: 1, resume: false };
  const cv = (action: string, selected = files, seed = "contract-seed") => ({ kind: "enrich", action, files: selected, seed });
  const documents = async () => JSON.parse(await h.read("opensearch-state.json")).documents;
  try {
    await h.operation("01-fetch", fetchRequest);
    await h.capture("01-checkpoint.json", directory + "checkpoint.json");
    await h.operation("02-resume", { ...fetchRequest, resume: true, maxBatches: 3 });
    await h.capture("02-checkpoint.json", directory + "checkpoint.json");
    assert.equal(JSON.parse(h.outputs["02-checkpoint.json"]).fetched, 8);
    for (const file of files) await h.capture("raw-" + file, directory + file);
    await h.operation("03-complete-resume", { ...fetchRequest, resume: true });
    await h.operation("04-reject-restart", fetchRequest, "failed");
    await h.operation("05-reject-changed-batch-size", { ...fetchRequest, resume: true, batchSize: 2 }, "failed");
    h.record("06-preview.json", await h.api("POST", "/api/batches/preview", { dataset: "contract", file: files[0], page: 1, pageSize: 2 }));
    await h.operation("07-cv-preview", cv("preview", [files[0]]));
    assert.equal(await h.read(directory + files[0]), h.outputs["raw-" + files[0]], "Preview must not write");
    await h.operation("08-cv-add", cv("add"));
    for (const file of files) {
      await h.capture("cv-" + file, directory + file);
      assert.equal(await h.read(directory + ".cv-backups/" + file), h.outputs["raw-" + file], "Backup must preserve original bytes");
    }
    await h.operation("09-cv-add-again", cv("add"));
    for (const file of files) assert.equal(await h.read(directory + file), h.outputs["cv-" + file], "Repeated add must not change bytes");
    await h.operation("10-setup-register", { kind: "setup", configuration: { ...h.configuration, modelId: "" } });
    await h.operation("11-setup-existing", { kind: "setup" });
    await h.operation("12-embed-first", { kind: "embed", files: [files[0]] });
    const first = await documents();
    assert.equal(Object.keys(first["contract-main"]).length, 3);
    await h.operation("13-embed-first-again", { kind: "embed", files: [files[0]] });
    assert.deepEqual(await documents(), first, "Re-embedding must upsert by ID");
    await h.operation("14-embed-remaining", { kind: "embed", files: files.slice(1) });
    assert.equal(Object.keys((await documents())["contract-main"]).length, 8);
    h.record("14-indexed-documents.json", await documents());
    for (const [name, query, limit] of [["15-java", "  candidates with Java experience  ", 1], ["16-unicode", "東京 Java 開発", 20], ["17-large-limit", "JavaScript", 100]] as const) {
      const search = await h.operation(name, { kind: "search", query, limit });
      const best = search.result.candidates[0];
      assert.equal(best.candidate.id, "003000000000001");
      assert.equal(best.lexicalScore, 19);
      assert.equal(best.vectorScore, 0.91);
      assert.equal(best.lexicalRank, 2);
      assert.equal(best.vectorRank, 1);
      assert.equal(best.score, 1 / 62 + 1 / 61);
      assert.equal(best.rankingMethod, "rrf");
      assert.equal(search.result.candidates.length, Math.min(limit, 8));
    }
    h.outputs["18-cli-search.txt"] = await h.cli("search", ["--index", "contract-main", "Java", "experience"]);
    await h.recordRequests("18-cli-search");
    const secondary = { ...h.configuration, index: "contract-secondary", automaticPipelines: false, ingestPipeline: "manual-ingest", searchPipeline: "manual-search" };
    await h.operation("19-setup-secondary", { kind: "setup", configuration: secondary });
    await h.operation("20-embed-secondary", { kind: "embed", configuration: secondary, files: [files[1]] });
    await h.operation("21-search-secondary", { kind: "search", configuration: secondary, query: "Finance", limit: 10 });
    assert.equal(Object.keys((await documents())["contract-main"]).length, 8, "Index override must not affect first index");
    await h.operation("22-cv-regenerate", cv("regenerate", [files[0]], "another-seed"));
    assert.notEqual(await h.read(directory + files[0]), h.outputs["cv-" + files[0]]);
    assert.equal(await h.read(directory + files[1]), h.outputs["cv-" + files[1]]);
    await h.capture("22-regenerated.json", directory + files[0]);
    await h.operation("23-embed-regenerated", { kind: "embed", files: [files[0]] });
    await h.fault({ rejectId: "003000000000001", onlyFirstAttempt: true, status: 429 });
    await h.operation("24-retry-throttled-item", { kind: "embed", files: [files[0]] });
    await h.fault({ rejectId: "003000000000001", status: 400 });
    await h.operation("25-permanent-item-failure", { kind: "embed", files: [files[0]] }, "failed");
    await h.fault({ incomplete: true });
    await h.operation("26-incomplete-acknowledgements", { kind: "embed", files: [files[0]] }, "failed");
    await h.fault({});
    await h.operation("27-recover-embedding", { kind: "embed", files: [files[0]] });
    for (const [name, fault] of [["28-search-unavailable", { searchError: true }], ["29-search-timeout", { timedOut: true }], ["30-search-shard-failure", { failedShards: 1 }]] as const) {
      await h.fault(fault);
      await h.operation(name, { kind: "search", query: "Java", limit: 10 }, "failed");
    }
    await h.fault({});
    await h.operation("31-remove-cv", cv("remove"));
    for (const file of files) await h.capture("removed-" + file, directory + file);
    await h.operation("32-remove-again", cv("remove"));
    await h.operation("33-embed-removed", { kind: "embed", files });
    assert.equal(Object.keys((await documents())["contract-main"]).length, 7, "Blank candidate's previous synthetic document must be deleted");
    h.record("33-final-documents.json", await documents());
    h.outputs["34-cli-index.txt"] = (await h.cli("index", ["--source", "json", "--file", directory + files[0], "--index", "contract-main"]))
      .replaceAll(h.workspace, "<workspace>").replaceAll("\\", "/");
    await h.recordRequests("34-cli-index");
    await h.operation("35-empty-index-search", { kind: "search", configuration: { ...h.configuration, index: "empty-index" }, query: "Java", limit: 10 });
    for (const [name, request] of [
      ["empty-query", { kind: "search", query: "  ", limit: 10 }],
      ["invalid-limit", { kind: "search", query: "Java", limit: 101 }],
      ["duplicate-files", { kind: "embed", files: [files[0], files[0]] }],
      ["path-escape", { kind: "embed", files: ["../outside.json"] }],
    ] as const) {
      const response = await h.api("POST", "/api/operations", { configuration: h.configuration, ...request });
      assert.equal(response.status, 400);
      h.record("validation-" + name + ".json", response);
    }
    await h.recordRequests("36-validation-no-requests");
    assert.equal(h.outputs["36-validation-no-requests.requests.jsonl"], "");
    // Restart the actual server with mixed persisted history, including every CV action.
    const beforeRestart = await h.api("GET", "/api/operations");
    assert.equal(beforeRestart.status, 200);
    const recordsBeforeRestart = [];
    for (const operation of beforeRestart.body) {
      const record = await h.api("GET", "/api/operations/" + operation.id);
      assert.equal(record.status, 200);
      recordsBeforeRestart.push(record.body);
    }
    assert.deepEqual(new Set(recordsBeforeRestart.map((record) => record.kind)), new Set(["fetch", "enrich", "setup", "embed", "search"]));
    assert.ok(recordsBeforeRestart.some((record) => record.result?.enrichment?.changed > 0));
    assert.ok(recordsBeforeRestart.some((record) => record.progress.changed > 0));
    assert.ok(recordsBeforeRestart.some((record) => record.result?.files?.some((file: { deleted?: number }) => (file.deleted ?? 0) > 0)));
    await h.stopServer();
    await h.start();
    assert.deepEqual(await h.api("GET", "/api/operations"), beforeRestart);
    for (const record of recordsBeforeRestart) {
      const restored = await h.api("GET", "/api/operations/" + record.id);
      assert.equal(restored.status, 200);
      assert.deepEqual(restored.body, record, "Restart must preserve the complete operation history");
    }
    for (const file of files) {
      assert.equal(await h.read(directory + file), h.outputs["removed-" + file], "Restart must not change candidate files");
    }
    assert.deepEqual(await documents(), JSON.parse(h.outputs["33-final-documents.json"]));
    return h.outputs;
  } finally { await h.close(); }
}
