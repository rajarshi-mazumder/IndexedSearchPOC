import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import { OpenSearchCommandEnvironment } from "../presentation/cli/open-search-command-environment";
import { loadOpenSearchConfig } from "../infrastructure/config/opensearch-config";
import { config } from "./candidate-fixtures";

const run = promisify(execFile);

test("explicit index consistently selects setup/index/search pipelines without mutating environment", () => {
  const environment = { ...config, AWS_PROFILE: "offline" };
  const selected = loadOpenSearchConfig(OpenSearchCommandEnvironment.create(environment, "candidates-fsb"));
  assert.equal(selected.OPENSEARCH_INDEX, "candidates-fsb");
  assert.equal(selected.OPENSEARCH_INGEST_PIPELINE, "candidates-fsb-ingest");
  assert.equal(selected.OPENSEARCH_SEARCH_PIPELINE, "candidates-fsb-hybrid");
  assert.equal(selected.OPENSEARCH_MODEL_ID, config.OPENSEARCH_MODEL_ID);
  assert.equal(environment.OPENSEARCH_INDEX, config.OPENSEARCH_INDEX);
  assert.deepEqual(OpenSearchCommandEnvironment.create(environment), environment);
  for (const name of ["", "bad/index", "Uppercase", "x".repeat(94)]) {
    assert.throws(() => OpenSearchCommandEnvironment.create(environment, name));
  }
});

test("CLI rejects invalid batch combinations and unbounded full indexing before authentication", async () => {
  for (const args of [
    ["presentation/cli/fetch-candidates.ts", "--file", "old-export.json"],
    ["presentation/cli/fetch-candidates.ts", "--batch-size", "1001"],
    ["presentation/cli/fetch-candidates.ts", "--max-batches", "0"],
    ["presentation/cli/fetch-candidates.ts", "003000000000001"],
    ["presentation/cli/index-candidates.ts", "--source", "salesforce"],
  ]) {
    await assert.rejects(run(process.execPath, ["--import", "tsx", ...args], {
      env: { ...process.env, SF_TARGET_ORG: "invalid & alias", AWS_PROFILE: "offline" }, windowsHide: true,
    }), (error: unknown) => {
      const stderr = (error as { stderr: string }).stderr;
      assert.doesNotMatch(stderr, /authentication failed|credentials|Forbidden/);
      return true;
    });
  }
});

test("all OpenSearch CLIs reject an invalid --index before outgoing requests", async () => {
  for (const script of ["setup-opensearch", "index-candidates", "search"]) {
    const args = ["--import", "tsx", `presentation/cli/${script}.ts`, "--index", "bad/index"];
    if (script === "index-candidates") args.push("--source", "json");
    await assert.rejects(run(process.execPath, args, {
      env: { ...process.env, ...config, AWS_PROFILE: "offline", SF_TARGET_ORG: "invalid & alias" }, windowsHide: true,
    }), (error: unknown) => {
      assert.match((error as { stderr: string }).stderr, /invalid_format/);
      return true;
    });
  }
});
