import assert from "node:assert/strict";
import { test } from "node:test";
import { OfflineContractHarness } from "../support/offline-contract-harness";

test("failed relationship fetch preserves committed bytes and resumes after a server restart", { timeout: 60000 }, async () => {
  const h = await OfflineContractHarness.create();
  const directory = ".cache/candidates/contract/";
  const request = { kind: "fetch", batchSize: 3, maxBatches: 1, resume: false };
  try {
    await h.operation("first", request);
    const checkpoint = await h.read(directory + "checkpoint.json");
    const first = await h.read(directory + "batch-000001.json");
    await h.fault({ sfFailObject: "TagAssociation__c" });
    const failed = await h.operation("failure", { ...request, resume: true }, "failed");
    assert.match(failed.error, /Fixture Salesforce failure: TagAssociation__c/);
    assert.equal(await h.read(directory + "checkpoint.json"), checkpoint);
    assert.equal(await h.read(directory + "batch-000001.json"), first);
    await assert.rejects(() => h.read(directory + "batch-000002.json"), { code: "ENOENT" });
    await h.stopServer();
    await h.start();
    await h.fault({});
    await h.operation("resume", { ...request, resume: true, maxBatches: 3 });
    assert.equal(await h.read(directory + "batch-000001.json"), first);
    const final = JSON.parse(await h.read(directory + "checkpoint.json"));
    assert.equal(final.fetched, 8);
    assert.equal(final.complete, true);
    const all = await Promise.all([1, 2, 3].map(async (number) => JSON.parse(await h.read(directory + `batch-${String(number).padStart(6, "0")}.json`)).candidates));
    assert.equal(new Set(all.flat().map((candidate: any) => candidate.id)).size, 8);
  } finally { await h.close(); }
});
