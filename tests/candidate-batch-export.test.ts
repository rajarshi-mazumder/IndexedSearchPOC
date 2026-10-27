import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { test, TestContext } from "node:test";
import { Connection } from "jsforce";
import { ExportCandidateBatches, CandidateBatchExportProgress } from "../application/usecases/export-candidate-batches";
import { CandidateBatchExportStore } from "../application/ports/candidate-batch-export-store";
import { JsonCandidateBatchExportStore } from "../infrastructure/json/json-candidate-batch-export-store";
import { JsonCandidateSnapshotStore } from "../infrastructure/json/json-candidate-snapshot-store";
import { SalesforceCandidateRepository } from "../infrastructure/salesforce/salesforce-candidate-repository";
import { SalesforceQueryClient } from "../infrastructure/salesforce/salesforce-query-client";
import { IndexCandidates } from "../application/usecases/index-candidates";
import { CandidateDocumentFactory } from "../application/services/candidate-document-factory";
import { TemplateCandidateProfileGenerator } from "../application/services/template-candidate-profile-generator";
import { candidateFixture } from "./candidate-fixtures";
import { profileClient, profileRepository, enrichedRepository } from "./salesforce-profile-fixtures";

const id = (number: number) => "003" + String(number).padStart(12, "0");
const options = { org: "full", sourceId: "test-org-id", batchSize: 1000, maxBatches: 1, resume: false };

async function directory(t: TestContext) {
  const path = await mkdtemp(join(tmpdir(), "indexed-search-batches-"));
  t.after(async () => {
    assert.ok(resolve(path).startsWith(resolve(tmpdir()) + sep));
    assert.ok(path.includes("indexed-search-batches-"));
    await rm(path, { recursive: true, force: true });
  });
  return path;
}

test("bounded Salesforce exports resume across runs; files embed independently into one accumulated dataset", async (t) => {
  const path = await directory(t);
  const store = new JsonCandidateBatchExportStore(path);
  const queries: string[] = [];
  const connection = { version: "65.0", request: async (request: { url: string }, requestOptions: { timeout: number }) => {
    const soql = new URL(request.url, "https://offline.invalid").searchParams.get("q")!;
    queries.push(soql);
    assert.match(soql, /ORDER BY Id ASC LIMIT 1000$/);
    assert.doesNotMatch(soql, /OFFSET/);
    assert.equal(requestOptions.timeout, 120_000);
    const after = /Id > '(\w+)'/.exec(soql)?.[1];
    const start = after ? Number(after.slice(3)) + 1 : 1;
    if (start > 1) assert.equal(JSON.parse(await readFile(join(path, "checkpoint.json"), "utf8")).lastId, id(start - 1));
    return { done: true, records: Array.from({ length: Math.min(1000, 2505 - start + 1) }, (_, i) => ({
      Id: id(start + i), Name: "Candidate " + (start + i), Title: "Engineer", TagConnector__r: { SkillCode1__c: "Java" },
    })) };
  } } as unknown as Connection;
  const source = enrichedRepository(profileClient(undefined, (soql, limit) => new SalesforceQueryClient(connection).queryBatch(soql, limit)));
  const progress: CandidateBatchExportProgress[] = [];
  const first = await new ExportCandidateBatches(source, store).execute(options, (event) => progress.push(event));
  assert.equal(first.fetched, 1000);
  assert.equal(first.complete, false);
  assert.equal(queries.length, 1, "One-file operation must not prefetch the rest of the sandbox");
  const firstFile = await readFile(join(path, "batch-000001.json"), "utf8");
  const resumed = await new ExportCandidateBatches(source, new JsonCandidateBatchExportStore(path))
    .execute({ ...options, resume: true, maxBatches: 10 }, (event) => progress.push(event));
  assert.equal(resumed.fetched, 2505);
  assert.equal(resumed.batchNumber, 3);
  assert.equal(resumed.complete, true);
  assert.equal(queries.length, 3);
  assert.equal(await readFile(join(path, "batch-000001.json"), "utf8"), firstFile);
  assert.deepEqual((await readdir(path)).sort(), ["batch-000001.json", "batch-000002.json", "batch-000003.json", "checkpoint.json"]);
  assert.deepEqual(progress.filter((event) => event.stage === "saved").map((event) => event.count), [1000, 1000, 505]);
  await new ExportCandidateBatches(source, store).execute({ ...options, resume: true });
  assert.equal(queries.length, 3, "A completed export must not restart");

  const indexed = new Map<string, unknown>();
  const sizes: number[] = [];
  const factory = new CandidateDocumentFactory(new TemplateCandidateProfileGenerator());
  const reports: { processed: number; total: number; indexed: number; skipped: number }[] = [];
  for (const batchNumber of [1, 2, 3, 1]) {
    const file = join(path, `batch-${String(batchNumber).padStart(6, "0")}.json`);
    const indexer = new IndexCandidates(new JsonCandidateSnapshotStore(file), factory, {
      indexMany: async (documents) => { sizes.push(documents.length); documents.forEach((document) => indexed.set(document.salesforceId, document)); },
      removeMany: async (ids) => { ids.forEach((id) => indexed.delete(id)); },
    });
    const result = await indexer.execute(undefined, (event) => reports.push(event));
    assert.equal(result.indexed, batchNumber === 3 ? 505 : 1000);
  }
  assert.equal(indexed.size, 2505, "Repeating a file upserts its IDs instead of duplicating candidates");
  assert.ok(Math.max(...sizes) <= 100);
  assert.equal(reports.at(-1)?.processed, 1000);
});

test("an exact multiple ends with an empty probe and no empty batch file", async (t) => {
  const path = await directory(t);
  let calls = 0;
  const source = { getBatch: async () => ++calls === 1 ? [candidateFixture({ id: id(1) })] : [] };
  const result = await new ExportCandidateBatches(source, new JsonCandidateBatchExportStore(path))
    .execute({ ...options, batchSize: 1, maxBatches: 3 });
  assert.equal(result.complete, true);
  assert.equal(result.batchNumber, 1);
  assert.equal(result.fetched, 1);
  assert.deepEqual((await readdir(path)).sort(), ["batch-000001.json", "checkpoint.json"]);
});

test("a later fetch failure preserves the committed batch and resumes from that ID", async (t) => {
  const path = await directory(t);
  const store = new JsonCandidateBatchExportStore(path);
  const source = { getBatch: async (_: number, afterId?: string) => {
    if (afterId) throw new Error("Salesforce outage");
    return [candidateFixture({ id: id(1) })];
  } };
  await assert.rejects(new ExportCandidateBatches(source, store).execute({ ...options, batchSize: 1, maxBatches: 10 }), /outage/);
  assert.equal((await store.loadCheckpoint())!.lastId, id(1));
  assert.equal((await new JsonCandidateSnapshotStore(join(path, "batch-000001.json")).getAll()).length, 1);
  let cursor: string | undefined;
  await new ExportCandidateBatches({ getBatch: async (_, afterId) => { cursor = afterId; return []; } }, store)
    .execute({ ...options, batchSize: 1, resume: true });
  assert.equal(cursor, id(1));
});

test("a checkpoint write failure re-fetches only the uncommitted file on resume", async (t) => {
  const path = await directory(t);
  const disk = new JsonCandidateBatchExportStore(path);
  const broken: CandidateBatchExportStore = {
    withLock: (operation) => disk.withLock(operation), loadCheckpoint: () => disk.loadCheckpoint(),
    saveBatch: (number, candidates) => disk.saveBatch(number, candidates),
    saveCheckpoint: async (checkpoint) => {
      if (checkpoint.batchNumber === 1) throw new Error("Disk checkpoint failure");
      await disk.saveCheckpoint(checkpoint);
    },
  };
  const cursors: (string | undefined)[] = [];
  const source = { getBatch: async (_: number, afterId?: string) => {
    cursors.push(afterId);
    return [candidateFixture({ id: id(1) })];
  } };
  await assert.rejects(new ExportCandidateBatches(source, broken).execute(options), /Disk checkpoint/);
  assert.equal((await disk.loadCheckpoint())!.fetched, 0);
  await new ExportCandidateBatches(source, disk).execute({ ...options, resume: true });
  assert.deepEqual(cursors, [undefined, undefined]);
  assert.equal((await disk.loadCheckpoint())!.fetched, 1);
});

test("a failed batch save leaves its cursor unchanged", async (t) => {
  const path = await directory(t);
  const disk = new JsonCandidateBatchExportStore(path);
  const broken: CandidateBatchExportStore = {
    withLock: (operation) => disk.withLock(operation), loadCheckpoint: () => disk.loadCheckpoint(),
    saveCheckpoint: (checkpoint) => disk.saveCheckpoint(checkpoint), saveBatch: async () => { throw new Error("Disk full"); },
  };
  await assert.rejects(new ExportCandidateBatches({ getBatch: async () => [candidateFixture()] }, broken).execute(options), /Disk full/);
  assert.equal((await disk.loadCheckpoint())!.fetched, 0);
});

test("resume validates source and batch size, and rejects restart or missing checkpoint", async (t) => {
  const store = new JsonCandidateBatchExportStore(await directory(t));
  let calls = 0;
  const source = { getBatch: async () => { calls++; return [candidateFixture()]; } };
  const usecase = new ExportCandidateBatches(source, store);
  await assert.rejects(usecase.execute({ ...options, resume: true }), /No export checkpoint/);
  await usecase.execute(options);
  await assert.rejects(usecase.execute(options), /already exists/);
  for (const mismatch of [{ org: "other" }, { sourceId: "refreshed-sandbox-id" }, { batchSize: 500 }]) {
    await assert.rejects(usecase.execute({ ...options, ...mismatch, resume: true }), /same Salesforce org/);
  }
  assert.equal(calls, 1);
});

test("lock prevents concurrent writers and is released after a failure", async (t) => {
  const path = await directory(t);
  const store = new JsonCandidateBatchExportStore(path);
  await assert.rejects(store.withLock(async () => {
    await assert.rejects(new JsonCandidateBatchExportStore(path).withLock(async () => {}), /locked/);
    throw new Error("Failure inside lock");
  }), /Failure inside lock/);
  await store.withLock(async () => {});
  assert.equal((await readdir(path)).includes(".export.lock"), false);
});

test("a stop request commits the current batch and releases its lock", async (t) => {
  const path = await directory(t);
  const controller = new AbortController();
  let calls = 0;
  const result = await new ExportCandidateBatches({ getBatch: async () => {
    calls++; controller.abort(); return [candidateFixture()];
  } }, new JsonCandidateBatchExportStore(path)).execute({ ...options, batchSize: 1, maxBatches: 10 }, undefined, controller.signal);
  assert.equal(calls, 1);
  assert.equal(result.fetched, 1);
  assert.equal((await readdir(path)).includes(".export.lock"), false);
});

test("edited or missing last batch and malformed checkpoints cannot silently resume", async (t) => {
  const path = await directory(t);
  const store = new JsonCandidateBatchExportStore(path);
  const usecase = new ExportCandidateBatches({ getBatch: async () => [candidateFixture()] }, store);
  await usecase.execute(options);
  await new JsonCandidateSnapshotStore(join(path, "batch-000001.json")).save([candidateFixture({ id: id(2) })]);
  await assert.rejects(usecase.execute({ ...options, resume: true }), /does not match/);
  await rm(join(path, "batch-000001.json"));
  await assert.rejects(usecase.execute({ ...options, resume: true }), /not found/);
  await writeFile(join(path, "checkpoint.json"), JSON.stringify({ version: 9 }));
  await assert.rejects(usecase.execute({ ...options, resume: true }));
});

test("batch source validates cursor/size before I/O and never uses OFFSET", async () => {
  const queries: string[] = [];
  const client = { queryBatch: async (query: string, limit: number) => {
    queries.push(query); assert.equal(limit, 1000); return [];
  } } as unknown as SalesforceQueryClient;
  const repository = profileRepository(profileClient(undefined, (soql, limit) => client.queryBatch(soql, limit)));
  await repository.getBatch(1000, id(1));
  assert.match(queries[0], /AND Id > '003000000000001' ORDER BY Id ASC LIMIT 1000/);
  await assert.rejects(repository.getBatch(1001));
  await assert.rejects(repository.getBatch(1000, "injection'"));
  assert.equal(queries.length, 1);
});

test("bounded queries follow short REST pages without mistaking them for an incomplete export", async () => {
  const calls: string[] = [];
  const connection = { version: "65.0", request: async (request: { url: string }) => {
    calls.push(request.url);
    return calls.length === 1 ? { records: [{ Id: id(1) }], done: false, nextRecordsUrl: "/services/data/v65.0/query/locator-1" }
      : { records: [{ Id: id(2) }], done: true };
  } } as unknown as Connection;
  assert.equal((await new SalesforceQueryClient(connection).queryBatch("SELECT Id FROM Contact LIMIT 2", 2)).length, 2);
  assert.equal(calls[1], "/services/data/v65.0/query/locator-1");
});

test("bounded query failures, invalid continuation and oversized responses propagate", async () => {
  for (const response of [
    { done: true, records: [{ Id: id(1) }, { Id: id(2) }] },
    { done: false, records: [{ Id: id(1) }], nextRecordsUrl: "https://untrusted.invalid/query" },
  ]) {
    const connection = { version: "65.0", request: async () => response } as unknown as Connection;
    await assert.rejects(new SalesforceQueryClient(connection).queryBatch("SELECT Id FROM Contact LIMIT 1", 1), /limit|continuation/);
  }
  const connection = { version: "65.0", request: async () => { throw new Error("Request timeout"); } } as unknown as Connection;
  await assert.rejects(new SalesforceQueryClient(connection).queryBatch("SELECT Id FROM Contact LIMIT 1", 1), /timeout/);
});

test("the full sandbox record count exports 1255 ordered bounded batches", async () => {
  const total = 1_254_365;
  let fetched = 0;
  let saved = 0;
  let files = 0;
  let checkpointWrites = 0;
  let uncommitted = false;
  const source = { getBatch: async (limit: number, afterId?: string) => {
    assert.equal(uncommitted, false, "The previous file and cursor must be saved before another query");
    assert.equal(afterId, fetched ? id(fetched) : undefined);
    assert.equal(limit, 1000);
    const start = fetched;
    const count = Math.min(limit, total - fetched);
    fetched += count;
    uncommitted = true;
    return Array.from({ length: count }, (_, i) => candidateFixture({ id: id(start + i + 1) }));
  } };
  const store: CandidateBatchExportStore = {
    withLock: (operation) => operation(), loadCheckpoint: async () => undefined,
    saveBatch: async (number, candidates) => {
      assert.equal(number, ++files);
      assert.ok(candidates.length <= 1000);
      saved += candidates.length;
      return `batch-${number}.json`;
    },
    saveCheckpoint: async (checkpoint) => {
      checkpointWrites++;
      assert.equal(checkpoint.fetched, saved);
      uncommitted = false;
    },
  };
  const result = await new ExportCandidateBatches(source, store).execute({ ...options, maxBatches: 2000 });
  assert.equal(result.fetched, total);
  assert.equal(files, 1255);
  assert.equal(checkpointWrites, 1256);
  assert.equal(result.complete, true);
});
