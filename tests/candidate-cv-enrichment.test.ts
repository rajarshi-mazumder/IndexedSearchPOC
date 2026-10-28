import assert from "node:assert/strict";
import { test, TestContext } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { candidateFixture } from "./candidate-fixtures";
import { consoleConfiguration } from "./console-fixtures";
import { GenerateDemoCvForCandidateService } from "../backend/dataPreparation/application/services/generateDemoCvForCandidateService";
import { candidateCvProfileSchema } from "../backend/candidateData/repositories/candidateCvProfileSchema";
import { CandidateSnapshotSerializer } from "../backend/candidateData/repositories/candidateSnapshotSerializer";
import { CandidateDemoCvFileRepository } from "../backend/candidateData/repositories/candidateDemoCvFileRepository";
import { LocalCandidateBatchCatalog } from "../backend/candidateData/repositories/localCandidateBatchCatalog";
import { LocalCandidateDatasetLock } from "../backend/candidateData/repositories/localCandidateDatasetLock";
import { CandidateBatchFileRepository } from "../backend/candidateData/repositories/candidateBatchFileRepository";
import { UpdateCandidateDemoCvTestDriver as EnrichCandidateBatchFiles } from "./support/updateCandidateDemoCvTestDriver";
import { GenerateCandidateProfileTestDriver as TemplateCandidateProfileGenerator } from "./support/generateCandidateProfileTestDriver";
import { CandidateConsoleEnvironment } from "../backend/host/config/candidateConsoleEnvironment";
import { CandidateConsoleValidation } from "../backend/host/services/candidateConsoleValidation";
import { PrepareCandidateDocumentTestDriver as CandidateDocumentFactory } from "./support/prepareCandidateDocumentTestDriver";
import { OpenSearchCandidateDocumentMapper } from "../backend/candidateData/mappers/openSearchCandidateDocumentMapper";
import { EmbedCandidatesTestDriver as IndexCandidates } from "./support/embedCandidatesTestDriver";
import { DummyCandidateRepository } from "../backend/dataPreparation/infrastructure/repositories/dummyCandidateRepository";

const generator = new GenerateDemoCvForCandidateService();
const file = "batch-000001.json";
const signal = () => new AbortController().signal;
async function fixture(t: TestContext, count = 25) {
  const root = await mkdtemp(join(tmpdir(), "candidate-cv-"));
  t.after(async () => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); await rm(root, { recursive: true, force: true }); });
  const catalog = new LocalCandidateBatchCatalog(root);
  const directory = await catalog.datasetPath("cv-test", true);
  const candidates = Array.from({ length: count }, (_, i) => candidateFixture({ id: "003" + String(i + 1).padStart(12, "0"), systems: ["Java"],
    enrichment: { version: 2, details: { desiredTitle: "Lead Engineer" }, tags: [], associations: [], warnings: [] } }));
  const original = CandidateSnapshotSerializer.serialize(candidates, new Date("2026-01-01T00:00:00Z"));
  await writeFile(join(directory, file), original);
  const checkpoint = JSON.stringify({ version: 1, org: "full", sourceId: "org-id", extractionKey: "scope-v2", batchSize: count,
    batchNumber: 1, fetched: count, lastId: candidates.at(-1)!.id, complete: false });
  await writeFile(join(directory, "checkpoint.json"), checkpoint);
  const editor = new CandidateDemoCvFileRepository(catalog, "cv-test");
  return { directory, candidates: CandidateSnapshotSerializer.deserialize(original), original, checkpoint, editor, usecase: new EnrichCandidateBatchFiles(editor, generator) };
}

test("synthetic CV generation is deterministic, varied, coherent and distinguishes Java from JavaScript", () => {
  const java = candidateFixture({ systems: ["Java"] });
  assert.deepEqual(generator.generate(java, "a"), generator.generate(java, "a"));
  assert.notDeepEqual(generator.generate(java, "a"), generator.generate(java, "b"));
  assert.equal(generator.generate(java, "a").source.archetype, "java-backend");
  const js = generator.generate(candidateFixture({ systems: ["JavaScript"] }), "a");
  assert.equal(js.source.archetype, "frontend");
  assert.doesNotMatch(JSON.stringify(js), /\bJava\b/);
  const types = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const cv = generator.generate(candidateFixture({ id: String(i) }), "a");
    candidateCvProfileSchema.parse(cv); types.add(cv.source.archetype);
    assert.ok(cv.employmentHistory[0].end < cv.employmentHistory[1].start);
    assert.ok(cv.education[0].graduationYear <= Number(cv.employmentHistory[0].start.slice(0, 4)));
  }
  assert.equal(types.size, 7);
});

test("preview leaves files untouched; add backs up original, preserves cursor and skips repeat writes", async (t) => {
  const f = await fixture(t);
  const preview = await f.usecase.execute([file], "preview", "demo", () => {}, signal());
  assert.equal(preview.preview.length, 20); assert.equal(preview.changed, 0);
  assert.equal(await readFile(join(f.directory, file), "utf8"), f.original);
  const first = await f.usecase.execute([file], "add", "demo", () => {}, signal());
  assert.equal(first.changed, 25);
  const enriched = await readFile(join(f.directory, file), "utf8");
  assert.equal(await readFile(join(f.directory, ".cv-backups", file), "utf8"), f.original);
  const saved = await f.editor.read(file);
  for (const [index, candidate] of saved.entries()) {
    assert.equal(candidate.enrichment!.cvProfile!.source.kind, "synthetic");
    delete candidate.enrichment!.cvProfile;
    assert.deepEqual(candidate, f.candidates[index]);
  }
  assert.equal(await readFile(join(f.directory, "checkpoint.json"), "utf8"), f.checkpoint);
  assert.equal((await new CandidateBatchFileRepository(f.directory).loadCheckpoint())!.fetched, 25);
  const again = await f.usecase.execute([file], "add", "different-seed", () => {}, signal());
  assert.equal(again.changed, 0); assert.equal(again.skipped, 25);
  assert.equal(await readFile(join(f.directory, file), "utf8"), enriched);
});

test("regenerate and remove affect CV only and keep the first backup", async (t) => {
  const f = await fixture(t, 2);
  await f.usecase.execute([file], "add", "a", () => {}, signal());
  const before = (await f.editor.read(file))[0].enrichment!.cvProfile;
  await f.usecase.execute([file], "regenerate", "b", () => {}, signal());
  assert.notDeepEqual((await f.editor.read(file))[0].enrichment!.cvProfile, before);
  await f.usecase.execute([file], "remove", "b", () => {}, signal());
  const removed = await f.editor.read(file);
  assert.ok(removed.every((candidate) => candidate.enrichment?.cvProfileRemoved));
  removed.forEach((candidate) => { delete candidate.enrichment!.cvProfileRemoved; });
  assert.deepEqual(removed, f.candidates);
  assert.equal(await readFile(join(f.directory, ".cv-backups", file), "utf8"), f.original);
  assert.equal((await f.usecase.execute([file], "remove", "b", () => {}, signal())).changed, 0);
});

test("stop commits the current file and retry skips it before continuing", async (t) => {
  const f = await fixture(t, 1); const second = "batch-000002.json";
  await writeFile(join(f.directory, second), CandidateSnapshotSerializer.serialize([candidateFixture({ id: "003000000000002" })], new Date()));
  await writeFile(join(f.directory, "checkpoint.json"), JSON.stringify({ ...JSON.parse(f.checkpoint), batchNumber: 2, fetched: 2, lastId: "003000000000002" }));
  const controller = new AbortController();
  const result = await f.usecase.execute([second, file], "add", "a", () => controller.abort(), controller.signal);
  assert.equal(result.completedFiles, 1);
  assert.equal((await f.editor.read(second))[0].enrichment, undefined);
  const retry = await f.usecase.execute([file, second], "add", "a", () => {}, signal());
  assert.equal(retry.changed, 1); assert.equal(retry.skipped, 1);
});

test("enrichment and export share a cross-process dataset lock, including after failures", async (t) => {
  const f = await fixture(t, 1);
  await new LocalCandidateDatasetLock(f.directory).withLock(async () => {
    await assert.rejects(f.usecase.execute([file], "add", "a", () => {}, signal()), /locked/);
    await assert.rejects(new CandidateBatchFileRepository(f.directory).withLock(async () => {}), /locked/);
  });
  await assert.rejects(f.usecase.execute(["batch-000002.json"], "add", "a", () => {}, signal()), /not committed/);
  assert.equal((await f.usecase.execute([file], "add", "a", () => {}, signal())).changed, 1);
});

test("CV survives snapshot and OpenSearch round trips and contributes to lexical and embedding text", () => {
  const candidate = candidateFixture();
  candidate.enrichment = { version: 2, details: {}, tags: [], associations: [], warnings: [], cvProfile: generator.generate(candidate, "a") };
  const saved = CandidateSnapshotSerializer.deserialize(CandidateSnapshotSerializer.serialize([candidate], new Date()))[0];
  const factory = new CandidateDocumentFactory(new TemplateCandidateProfileGenerator());
  const document = factory.create(saved)!;
  const phrase = saved.enrichment!.cvProfile!.projects[0].name;
  assert.ok(document.searchText.includes(phrase)); assert.ok(document.profile.includes(phrase));
  const mapped = OpenSearchCandidateDocumentMapper.fromDocument(OpenSearchCandidateDocumentMapper.toDocument(document));
  assert.deepEqual(mapped.candidate.enrichment!.cvProfile, candidate.enrichment.cvProfile);
  delete saved.enrichment!.cvProfile;
  assert.equal(factory.create(saved), null, "Removing the only professional content removes generated search evidence");
});

test("local CV actions need no AWS or Salesforce configuration and reject malformed requests", () => {
  const request = { kind: "enrich", configuration: { ...consoleConfiguration, endpoint: "", modelId: "", sfOrg: "" }, action: "add", seed: "demo", files: [file] };
  CandidateConsoleEnvironment.validate(CandidateConsoleValidation.operation(request), {});
  assert.throws(() => CandidateConsoleValidation.operation({ ...request, files: ["../escape.json"] }));
  assert.throws(() => CandidateConsoleValidation.operation({ ...request, seed: "" }));
});

test("re-embedding CV removals deletes only candidates left without professional content", async () => {
  const empty = candidateFixture({ enrichment: { version: 2, details: {}, tags: [], associations: [], warnings: [], cvProfileRemoved: true } });
  const real = { ...empty, id: "003000000000002", skills: ["Java"] };
  const untouched = candidateFixture({ id: "003000000000003" });
  const deleted: string[] = []; const indexed: string[] = [];
  const result = await new IndexCandidates(new DummyCandidateRepository([empty, real, untouched]),
    new CandidateDocumentFactory(new TemplateCandidateProfileGenerator()), {
      removeMany: async (ids) => { deleted.push(...ids); },
      indexMany: async (documents) => { indexed.push(...documents.map((document) => document.salesforceId)); },
    }).execute();
  assert.deepEqual(deleted, [empty.id]); assert.deepEqual(indexed, [real.id]);
  assert.equal(result.deleted, 1);
});

test("invalid generated content cannot replace a batch or alter its cursor", async (t) => {
  const f = await fixture(t, 1);
  const invalid = new EnrichCandidateBatchFiles(f.editor, { generate: (candidate, seed) => ({ ...generator.generate(candidate, seed), summary: "x".repeat(5000) }) });
  await assert.rejects(invalid.execute([file], "add", "a", () => {}, signal()));
  assert.equal(await readFile(join(f.directory, file), "utf8"), f.original);
  assert.equal(await readFile(join(f.directory, "checkpoint.json"), "utf8"), f.checkpoint);
  assert.equal((await f.usecase.execute([file], "add", "a", () => {}, signal())).changed, 1);
});
