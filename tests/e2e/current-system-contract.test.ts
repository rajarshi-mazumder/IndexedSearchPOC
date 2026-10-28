import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { currentSystemScenario } from "./current-system-scenario";

test("current preparation, embedding and search preserve frozen boundary bytes", { timeout: 240000 }, async () => {
  const root = resolve(__dirname, "fixtures");
  const manifest = JSON.parse(await readFile(join(root, "baseline-manifest.json"), "utf8"));
  const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  assert.deepEqual((await readdir(join(root, "input"))).sort(), Object.keys(manifest.inputs).sort());
  for (const [name, digest] of Object.entries(manifest.inputs)) {
    assert.equal(hash(await readFile(join(root, "input", name))), digest, "Scenario input changed: " + name);
  }
  const outputs = await currentSystemScenario();
  assert.deepEqual(Object.keys(outputs).sort(), Object.keys(manifest.artifacts).sort(), "Contract artifact set changed");
  assert.deepEqual((await readdir(join(root, "expected"))).sort(), Object.keys(manifest.artifacts).sort());
  const failures: string[] = [];
  for (const [name, actual] of Object.entries(outputs)) {
    const expected = await readFile(join(root, "expected", name));
    assert.equal(hash(expected), manifest.artifacts[name], "Golden expectation changed: " + name);
    if (!Buffer.from(actual, "utf8").equals(expected)) {
      const diagnostic = resolve(".cache/contract-diffs", name);
      await mkdir(resolve(".cache/contract-diffs"), { recursive: true });
      await writeFile(diagnostic, actual);
      failures.push(name);
    }
  }
  assert.deepEqual(failures, [], "Byte differences (actual output in .cache/contract-diffs); do not regenerate expectations during refactoring");
});
