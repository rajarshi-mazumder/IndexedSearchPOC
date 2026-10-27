import assert from "node:assert/strict";
import { test, TestContext } from "node:test";
import { mkdtemp, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { get } from "node:http";
import { join, resolve, sep } from "node:path";
import { CandidateOperationService } from "../application/services/candidate-operation-service";
import { CandidateConsoleSettingsService } from "../application/services/candidate-console-settings-service";
import { CandidateDatasetService } from "../application/services/candidate-dataset-service";
import { JsonConsoleSettingsStore } from "../infrastructure/json/json-console-settings-store";
import { JsonOperationHistoryStore } from "../infrastructure/json/json-operation-history-store";
import { AtomicJsonFileStore } from "../infrastructure/json/atomic-json-file-store";
import { LocalCandidateBatchCatalog } from "../infrastructure/json/local-candidate-batch-catalog";
import { CandidateSnapshotSerializer } from "../infrastructure/json/candidate-snapshot-serializer";
import { CandidateConsoleEnvironment } from "../infrastructure/config/candidate-console-environment";
import { CandidateConsoleWorkspaceLock } from "../infrastructure/process/candidate-console-workspace-lock";
import { CandidateConsoleServer } from "../presentation/http/candidate-console-server";
import { NodeCandidateOperationRunner } from "../infrastructure/process/node-candidate-operation-runner";
import { consoleConfiguration as configuration, ControlledCandidateOperationRunner, MemoryOperationHistoryStore } from "./console-fixtures";
import { candidateFixture } from "./candidate-fixtures";
import { CandidateConsoleOperationExecutor } from "../application/services/candidate-console-operation-executor";
import { CandidateConsoleOperations } from "../application/ports/candidate-console-operations";
import { WorkerEvent } from "../shared/candidate-console-contracts";

async function temporary(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "candidate-console-test-"));
  t.after(async () => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep)); await rm(directory, { recursive: true, force: true }); });
  return directory;
}
test("console settings whitelist fields, persist profiles and isolate operation environments", async (t) => {
  const path = join(await temporary(t), "settings.json");
  const settings = new CandidateConsoleSettingsService(new JsonConsoleSettingsStore(new AtomicJsonFileStore(path)), configuration);
  assert.deepEqual(await settings.list(), [configuration]);
  assert.throws(() => settings.save({ ...configuration, AWS_SECRET_ACCESS_KEY: "must-not-save" }));
  await Promise.all([settings.save(configuration), settings.save({ ...configuration, id: "other", name: "Other sandbox" })]);
  assert.equal((await settings.list()).length, 2);
  assert.equal((await new JsonConsoleSettingsStore(new AtomicJsonFileStore(path)).read()).length, 2);
  const base = { AWS_PROFILE: "original", AWS_REGION: "us-east-1" };
  const environment = CandidateConsoleEnvironment.create({ ...configuration, awsProfile: "another" }, base);
  assert.equal(environment.OPENSEARCH_INGEST_PIPELINE, "candidates-fsb-ingest");
  assert.equal(environment.AWS_PROFILE, "another"); assert.equal(base.AWS_PROFILE, "original");
  assert.equal("AWS_SECRET_ACCESS_KEY" in CandidateConsoleEnvironment.defaults({ AWS_SECRET_ACCESS_KEY: "hidden" }), false);
});
test("operations capture settings, reject simultaneous writers and retain results after stopping", async () => {
  const runner = new ControlledCandidateOperationRunner(); const history = new MemoryOperationHistoryStore();
  const service = new CandidateOperationService(runner, history); await service.initialize();
  const snapshot = { ...configuration };
  const fetch = await service.start({ kind: "fetch", configuration: snapshot, batchSize: 1000, maxBatches: 2, resume: false });
  snapshot.index = "changed-after-start";
  assert.equal(service.get(fetch.id).request.configuration.index, configuration.index);
  await assert.rejects(service.start({ kind: "embed", configuration, files: ["batch-000001.json"] }), /Another data operation/);
  const search = await service.start({ kind: "search", configuration, query: "Java", limit: 10 });
  await assert.rejects(service.start({ kind: "search", configuration, query: "Java", limit: 10 }), /Another data operation/);
  runner.calls[1].report({ type: "result", result: { candidates: [] }, cancelled: false }); runner.calls[1].exited();
  assert.equal(service.get(search.id).status, "succeeded");
  service.stop(fetch.id); assert.equal(runner.calls[0].stopped, true);
  runner.calls[0].report({ type: "result", result: { fetched: 1000, batchNumber: 1, complete: false }, cancelled: true }); runner.calls[0].exited();
  assert.equal(service.get(fetch.id).status, "cancelled"); assert.equal(service.get(fetch.id).result?.fetched, 1000);
  await service.close(); assert.equal(history.records.length, 2);
  assert.equal("request" in service.list()[0], false);
});
test("failed workers keep completed file receipts, and prior active runs become interrupted", async (t) => {
  const runner = new ControlledCandidateOperationRunner();
  const history = new JsonOperationHistoryStore(new AtomicJsonFileStore(join(await temporary(t), "history.json")));
  const service = new CandidateOperationService(runner, history); await service.initialize();
  const job = await service.start({ kind: "embed", configuration, files: ["batch-000001.json", "batch-000002.json"] });
  runner.calls[0].report({ type: "file", result: { file: "batch-000001.json", indexed: 950, skipped: 50, hash: "abc", size: 20, modifiedAt: "2026-10-27T00:00:00.000Z" } });
  runner.calls[0].exited("Network failed");
  assert.equal(service.get(job.id).status, "failed"); assert.equal(service.embeddingHistory(configuration)[0].indexed, 950);
  assert.equal(service.embeddingHistory({ ...configuration, index: "other-index" }).length, 0);
  await service.close(); assert.equal((await history.read())[0].result?.files?.length, 1);
  const persisted = service.get(job.id); persisted.status = "running"; await history.write([persisted]);
  const restarted = new CandidateOperationService(new ControlledCandidateOperationRunner(), history); await restarted.initialize();
  assert.equal(restarted.get(job.id).status, "interrupted"); await restarted.close();
});
test("catalog paginates files and records, rejects escape paths and marks only checkpointed files", async (t) => {
  const directory = await temporary(t); const catalog = new LocalCandidateBatchCatalog(directory); const path = await catalog.datasetPath("fsb", true);
  const candidates = Array.from({ length: 25 }, (_, index) => candidateFixture({ id: String(index), name: `Person ${index}` }));
  await writeFile(join(path, "batch-000001.json"), CandidateSnapshotSerializer.serialize(candidates, new Date()));
  await writeFile(join(path, "batch-000002.json"), CandidateSnapshotSerializer.serialize([], new Date()));
  await writeFile(join(path, "checkpoint.json"), JSON.stringify({ org: "full", fetched: 25, batchNumber: 1, batchSize: 1000, complete: true }));
  const page = await catalog.list("fsb", 1, 1); assert.equal(page.files.length, 1); assert.equal(page.totalFiles, 2); assert.equal(page.files[0].records, 25);
  assert.equal((await catalog.list("fsb", 2, 1)).files[0].committed, false);
  assert.equal((await catalog.preview("fsb", "batch-000001.json", 2, 20)).candidates.length, 5);
  await catalog.assertCommitted("fsb", "batch-000001.json");
  await assert.rejects(catalog.assertCommitted("fsb", "batch-000002.json"), /not committed/);
  await assert.rejects(catalog.preview("../outside", "batch-000001.json", 1, 20));
  await assert.rejects(catalog.preview("fsb", "../../secret.json", 1, 20));
  const outside = await temporary(t); await symlink(outside, join(directory, "escape"), "junction");
  await assert.rejects(catalog.datasetPath("escape"), /inside/);
  const service = new CandidateDatasetService(catalog, { embeddingHistory: () => [] });
  assert.throws(() => service.preview({ dataset: "fsb", file: "batch-000001.json", page: 1, pageSize: 1001 }));
});
test("workspace lock excludes a second console regardless of port and releases cleanly", async (t) => {
  const path = join(await temporary(t), "console.lock"); const first = new CandidateConsoleWorkspaceLock(path); const second = new CandidateConsoleWorkspaceLock(path);
  await first.acquire(); await assert.rejects(second.acquire(), /Another console/); await first.release(); await second.acquire(); await second.release();
});
test("HTTP API enforces local origin and session token and streams live progress", async (t) => {
  const directory = await temporary(t); await mkdir(join(directory, "public")); await writeFile(join(directory, "public/index.html"), "Console");
  const runner = new ControlledCandidateOperationRunner(); const service = new CandidateOperationService(runner, new MemoryOperationHistoryStore()); await service.initialize();
  const settings = new CandidateConsoleSettingsService(new JsonConsoleSettingsStore(new AtomicJsonFileStore(join(directory, "settings.json"))), configuration);
  const server = new CandidateConsoleServer(settings, service, new CandidateDatasetService(new LocalCandidateBatchCatalog(directory), service), join(directory, "public"));
  const port = await server.listen(0); t.after(() => server.close()); const base = `http://127.0.0.1:${port}`;
  assert.equal(await (await fetch(base)).text(), "Console");
  assert.equal((await fetch(base + "/api/settings", { headers: { Origin: "https://untrusted.invalid" } })).status, 403);
  assert.equal(await new Promise<number | undefined>((done, reject) => get(base + "/api/settings", { headers: { Host: "untrusted.invalid" } }, (response) => { response.resume(); done(response.statusCode); }).on("error", reject)), 403);
  assert.equal((await fetch(base + "/api/settings", { method: "PUT", body: JSON.stringify(configuration), headers: { "Content-Type": "application/json" } })).status, 403);
  const { token } = await (await fetch(base + "/api/session")).json() as { token: string }; const headers = { "Content-Type": "application/json", "x-console-token": token };
  assert.equal((await fetch(base + "/api/settings", { method: "PUT", body: JSON.stringify(configuration), headers })).status, 200);
  const stream = await fetch(base + "/api/events"); const reader = stream.body!.getReader();
  assert.match(Buffer.from((await reader.read()).value!).toString(), /event: snapshot/);
  const response = await fetch(base + "/api/operations", { method: "POST", headers, body: JSON.stringify({ kind: "fetch", configuration, batchSize: 1000, maxBatches: 1, resume: false }) });
  assert.equal(response.status, 202); const job = await response.json() as { id: string };
  assert.match(Buffer.from((await reader.read()).value!).toString(), /event: operation/);
  runner.calls[0].report({ type: "progress", progress: { message: "Saved batch 1", fetched: 1000 } });
  assert.match(Buffer.from((await reader.read()).value!).toString(), /Saved batch 1/);
  await reader.cancel();
  assert.equal(((await (await fetch(base + "/api/operations/" + job.id)).json()) as { progress: { fetched: number } }).progress.fetched, 1000);
});
test("worker process receives an isolated configuration and handles stop over IPC", async (t) => {
  const directory = await temporary(t);
  await writeFile(join(directory, ".env"), "AWS_PROFILE=must-not-reload\n");
  const runner = new NodeCandidateOperationRunner(resolve("tests/ui/fixture-operation-worker.ts"), directory);
  for (const profile of ["isolated-profile", ""]) {
  let stop: () => void = () => {}; let sawProgress = false;
  await new Promise<void>((done, reject) => {
    const timer = setTimeout(() => { handle.terminate(); reject(new Error("Worker test timed out")); }, 15_000);
    const handle = runner.start({ kind: "search", configuration: { ...configuration, awsProfile: profile }, query: "test", limit: 1 }, (event) => {
      try {
        if (event.type === "progress") { assert.equal(event.progress.message, (profile || "undefined") + ":candidates-fsb"); sawProgress = true; stop(); }
        if (event.type === "result") assert.equal(event.cancelled, true);
        if (event.type === "error") throw new Error(event.message);
      } catch (error) { clearTimeout(timer); handle.terminate(); reject(error); }
    }, (error) => { clearTimeout(timer); if (error) reject(new Error(error)); else done(); });
    stop = () => handle.stop();
  });
  assert.equal(sawProgress, true);
  }
});

test("embedding executor runs files sequentially and never records a changed file as successful", async () => {
  const events: WorkerEvent[] = []; const files: string[] = []; let fingerprintCalls = 0;
  const unavailable = async (): Promise<never> => { throw new Error("Unexpected operation"); };
  const operations: CandidateConsoleOperations = { enrich: unavailable, fetch: unavailable, setup: unavailable, search: unavailable,
    index: async (file, report) => { files.push(file); report({ processed: 1, total: 1, indexed: 1, skipped: 0 }); return { indexed: 1, skipped: 0 }; } };
  const executor = new CandidateConsoleOperationExecutor(operations, { validate: async () => {}, fingerprint: async () => ({
    hash: ++fingerprintCalls === 4 ? "changed" : "original", size: 100, modifiedAt: "2026-10-27T00:00:00.000Z",
  }) });
  await assert.rejects(executor.execute({ kind: "embed", configuration, files: ["batch-000002.json", "batch-000001.json"] }, (event) => events.push(event), new AbortController().signal), /changed during indexing/);
  assert.deepEqual(files, ["batch-000001.json", "batch-000002.json"]);
  assert.deepEqual(events.filter((event) => event.type === "file").map((event) => event.result.file), ["batch-000001.json"]);
});
