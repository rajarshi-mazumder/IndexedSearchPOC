import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { test, TestContext } from "node:test";
import { promisify } from "node:util";
import { EmbedCandidatesTestDriver as IndexCandidates } from "./support/embedCandidatesTestDriver";
import { FetchSelectedSalesforceCandidatesIntoFileUseCase as FetchSelectedSalesforceCandidatesIntoFileOrchestrator } from "../backend/dataPreparation/application/useCases/fetchSelectedSalesforceCandidatesIntoFileUseCase";
import { PersistFetchedCandidatesRepository } from "../backend/dataPreparation/infrastructure/repositories/persistFetchedCandidatesRepository";
import { PrepareCandidateDocumentTestDriver as CandidateDocumentFactory } from "./support/prepareCandidateDocumentTestDriver";
import { GenerateCandidateProfileTestDriver as TemplateCandidateProfileGenerator } from "./support/generateCandidateProfileTestDriver";
import { JsonCandidateSnapshotStore } from "../backend/candidateData/repositories/jsonCandidateSnapshotStore";
import { SalesforceCandidateRepository } from "../backend/dataPreparation/infrastructure/repositories/salesforceCandidateRepository";
import { SalesforceQueryClient } from "../backend/dataPreparation/infrastructure/repositories/salesforceQueryClient";
import { candidateFixture, config, recordingDocumentIndex } from "./candidate-fixtures";
import { enrichedRepository, profileClient } from "./salesforce-profile-fixtures";

const runFile = promisify(execFile);
const factory = new CandidateDocumentFactory(new TemplateCandidateProfileGenerator());

async function snapshotFile(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "indexed-search-snapshot-"));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    assert.ok(directory.includes("indexed-search-snapshot-"));
    await rm(directory, { recursive: true, force: true });
  });
  return { file: join(directory, "candidates.json"), directory };
}

test("fresh Salesforce retrieval persists DTOs before indexing; cached indexing needs no Salesforce", async (t) => {
  const { file } = await snapshotFile(t);
  const store = new JsonCandidateSnapshotStore(file);
  let queries = 0;
  const client = { query: async (query: string) => {
    if (query.includes("FROM TagAssociation__c")) return [];
    if (query.includes("FROM Account")) return [{ Id: "001000000000001", Name: "Example" }];
    assert.match(query, /\bTitle,/);
    assert.match(query, /\bAccountId,/);
    assert.match(query, /\bcurrentSalary__c,/);
    assert.doesNotMatch(query, /Current_Position__c/);
    queries++;
    return [{ Id: "003000000000001", Name: "Snapshot Candidate", Title: "Engineer",
      AccountId: "001000000000001", currentSalary__c: 7000000,
      TagConnector__r: { SkillCode1__c: "TypeScript", Systems1__c: "OpenSearch" } }];
  } } as unknown as SalesforceQueryClient;
  const source = enrichedRepository(profileClient((soql) => client.query(soql)));
  const freshIndex = recordingDocumentIndex();
  const originalIndexMany = freshIndex.index.indexMany;
  freshIndex.index.indexMany = async (documents) => {
    assert.equal(JSON.parse(await readFile(file, "utf8")).candidates[0].title, "Engineer");
    await originalIndexMany(documents);
  };
  const fresh = new IndexCandidates(new PersistFetchedCandidatesRepository(source, store), factory, freshIndex.index);
  assert.deepEqual(await fresh.execute(["003000000000001"]), { indexed: 1, skipped: 0 });
  const savedJson = await readFile(file, "utf8");
  const saved = JSON.parse(savedJson);
  assert.equal(saved.version, 2);
  assert.equal(saved.candidates[0].company, "Example");
  assert.equal(saved.candidates[0].salary, 7000000);
  assert.ok(Number.isFinite(Date.parse(saved.exportedAt)));
  assert.equal("embedding" in saved.candidates[0], false);
  const cachedIndex = recordingDocumentIndex();
  assert.deepEqual(await new IndexCandidates(store, factory, cachedIndex.index).execute(), { indexed: 1, skipped: 0 });
  assert.equal(queries, 1, "Cached indexing must not query Salesforce");
  assert.equal(cachedIndex.documents[0].searchText, freshIndex.documents[0].searchText);
  assert.equal(cachedIndex.documents[0].profile, freshIndex.documents[0].profile);
  // JSON omits optional properties whose value is undefined.
  assert.deepEqual(JSON.parse(JSON.stringify(cachedIndex.documents[0].candidate)),
    JSON.parse(JSON.stringify(freshIndex.documents[0].candidate)));
  assert.equal(await readFile(file, "utf8"), savedJson, "Cached mode must not rewrite the snapshot");
});

test("export-only fetches selected IDs without requiring an indexing adapter", async (t) => {
  const { file } = await snapshotFile(t);
  const calls: string[][] = [];
  const candidate = candidateFixture({ title: "Engineer" });
  const source = {
    getAll: async () => { throw new Error("Unexpected full retrieval"); },
    getByIds: async (ids: string[]) => { calls.push(ids); return [candidate]; },
  };
  const store = new JsonCandidateSnapshotStore(file);
  const exporter = new FetchSelectedSalesforceCandidatesIntoFileOrchestrator(new PersistFetchedCandidatesRepository(source, store));
  assert.deepEqual(await exporter.execute([candidate.id, candidate.id]), { fetched: 1 });
  assert.deepEqual(calls, [[candidate.id]]);
  assert.equal((await store.getAll())[0].id, candidate.id);
  assert.deepEqual(await exporter.execute([]), { fetched: 0 });
  assert.equal(calls.length, 1);
});

test("a failed Salesforce fetch preserves the old snapshot and makes no index writes", async (t) => {
  const { file } = await snapshotFile(t);
  const store = new JsonCandidateSnapshotStore(file);
  await store.save([candidateFixture({ title: "Previous" })]);
  const before = await readFile(file, "utf8");
  const fail = async () => { throw new Error("Salesforce unavailable"); };
  const index = recordingDocumentIndex();
  const usecase = new IndexCandidates(new PersistFetchedCandidatesRepository({ getAll: fail, getByIds: fail }, store), factory, index.index);
  await assert.rejects(usecase.execute(), /Salesforce unavailable/);
  assert.equal(await readFile(file, "utf8"), before);
  assert.equal(index.documents.length, 0);
});

test("a snapshot write failure prevents indexing", async () => {
  const candidate = candidateFixture({ title: "Engineer" });
  const source = { getAll: async () => [candidate], getByIds: async () => [candidate] };
  const snapshot = { ...source, save: async () => { throw new Error("Disk full"); } };
  const index = recordingDocumentIndex();
  await assert.rejects(new IndexCandidates(new PersistFetchedCandidatesRepository(source, snapshot), factory, index.index).execute(), /Disk full/);
  assert.equal(index.documents.length, 0);
});

test("snapshots replace atomically, validate candidates, normalize nulls, and select IDs", async (t) => {
  const { file, directory } = await snapshotFile(t);
  const store = new JsonCandidateSnapshotStore(file);
  const first = candidateFixture({ title: "First" });
  await store.save([first]);
  const second = candidateFixture({ id: "second", title: "Second" });
  await store.save([first, second]);
  assert.deepEqual((await store.getByIds(["second", "missing"])).map((candidate) => candidate.id), ["second"]);
  const valid = await readFile(file, "utf8");
  await assert.rejects(store.save([first, first]), /unique/);
  assert.equal(await readFile(file, "utf8"), valid);
  assert.deepEqual(await readdir(directory), ["candidates.json"], "Temporary files must be cleaned up");
  const snapshot = JSON.parse(valid);
  snapshot.candidates[0].title = null;
  snapshot.candidates[0].salary = null;
  await writeFile(file, JSON.stringify(snapshot));
  assert.equal((await store.getAll())[0].title, undefined);
  assert.equal((await store.getAll())[0].salary, undefined);
});

test("missing, malformed, unsupported, and incomplete snapshots fail before indexing", async (t) => {
  const { file } = await snapshotFile(t);
  const store = new JsonCandidateSnapshotStore(file);
  const index = recordingDocumentIndex();
  const usecase = new IndexCandidates(store, factory, index.index);
  await assert.rejects(usecase.execute(), /snapshot not found/);
  for (const contents of ["{bad", JSON.stringify({ version: 99, exportedAt: new Date().toISOString(), candidates: [] }),
    JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), candidates: [{ id: "incomplete" }] })]) {
    await writeFile(file, contents);
    await assert.rejects(usecase.execute(), /Invalid candidate snapshot/);
  }
  assert.equal(index.documents.length, 0);
});

test("the JSON CLI checks its file without Salesforce authentication or outgoing AWS calls", async (t) => {
  const { file } = await snapshotFile(t);
  await assert.rejects(runFile(process.execPath, ["--import", "tsx", "backend/host/cli/indexCandidates.ts", "--source", "json", "--file", file], {
    cwd: resolve(__dirname, ".."),
    env: { ...process.env, ...config, SF_TARGET_ORG: "invalid & alias", AWS_PROFILE: "nonexistent-offline-profile" },
    windowsHide: true,
  }), (error: unknown) => {
    assert.match((error as { stderr: string }).stderr, /snapshot not found/);
    assert.doesNotMatch((error as { stderr: string }).stderr, /Salesforce org alias|credentials|Forbidden/);
    return true;
  });
});
