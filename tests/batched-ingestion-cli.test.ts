import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { config, setupConfig } from "./candidate-fixtures";
import { metadataFields, candidateRecordType, systemRecordType } from "./salesforce-profile-fixtures";

const run = promisify(execFile);

test("actual CLI commands fetch/resume files and select the same explicit index for setup, embedding and search", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "indexed-search-cli-batches-"));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    assert.ok(directory.includes("indexed-search-cli-batches-"));
    await rm(directory, { recursive: true, force: true });
  });
  const queries: string[] = [];
  const id = (number: number) => "003" + String(number).padStart(12, "0");
  const server = createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    const object = /sobjects\/(\w+)\/describe/.exec(request.url!)?.[1];
    if (object) { response.end(JSON.stringify({ queryable: true, fields: metadataFields[object].map((name) => ({ name, type: "string" })) })); return; }
    const query = new URL(request.url!, "http://localhost").searchParams.get("q")!;
    if (query.includes("FROM RecordType")) {
      response.end(JSON.stringify({ done: true, records: [{ Id: candidateRecordType, DeveloperName: "Candidate", SobjectType: "Contact" },
        { Id: systemRecordType, DeveloperName: "Systems", SobjectType: "Tag__c" }] })); return;
    }
    if (!query.includes("FROM Contact")) { response.end(JSON.stringify({ done: true, records: [] })); return; }
    queries.push(query);
    const after = /Id > '(\w+)'/.exec(query)?.[1];
    const start = after ? Number(after.slice(3)) + 1 : 1;
    const count = Math.min(1000, 1003 - start + 1);
    response.end(JSON.stringify({ done: true, totalSize: count, records: Array.from({ length: count }, (_, i) => ({
      Id: id(start + i), Name: "CLI Candidate " + (start + i), Title: "Engineer",
      Account: { Name: "Example" }, TagConnector__r: { SkillCode1__c: "Java" },
    })) }));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  t.after(() => new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}`;
  const log = join(directory, "requests.jsonl");
  const preload = join(directory, "external-adapters.mjs");
  const authModule = pathToFileURL(resolve("backend/dataPreparation/infrastructure/repositories/salesforceCliCommand.ts")).href;
  const awsModule = pathToFileURL(resolve("backend/infrastructure/opensearch/openSearchServerlessClient.ts")).href;
  // Test-only adapter replacement: actual CLI parsing/bootstrap/use cases/storage
  // run in child processes, Salesforce HTTP stays local, AWS calls are recorded.
  await writeFile(preload, `
import { appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const auth = require(fileURLToPath(${JSON.stringify(authModule)}));
auth.SalesforceCliCommand.prototype.execute = function(args) {
  if (!args.includes('full')) throw new Error('CLI did not select the explicit --org');
  return JSON.stringify({status:0,result:args.includes('display')
    ? {instanceUrl:${JSON.stringify(endpoint)},id:'offline-full-org'} : {accessToken:'offline-token'}});
};
const awsPath = fileURLToPath(${JSON.stringify(awsModule)});
require(awsPath);
const record = value => appendFileSync(${JSON.stringify(log)}, JSON.stringify(value)+'\\n');
require.cache[require.resolve(awsPath)].exports = {OpenSearchServerlessClient: class {
  constructor(config) {
    record({operation:'configuration',index:config.OPENSEARCH_INDEX});
    this.connection = {
      close: async () => {},
      indices: {
        exists: async () => ({body:false}),
        getMapping: async () => ({body:{[config.OPENSEARCH_INDEX]:{mappings:{_meta:{schema_version:3},properties:{enrichment:{type:'object',enabled:false}}}}}}),
        create: async request => {record({operation:'create',index:request.index});return {body:{acknowledged:true}};}
      },
      bulk: async request => {
        record({operation:'bulk',pipeline:request.pipeline,index:request.body[0].index._index,
          ids:request.body.filter((_,i)=>i%2===0).map(item=>item.index._id)});
        return {body:{errors:false,items:Array.from({length:request.body.length/2},()=>({index:{status:200}}))}};
      },
      search: async request => {
        record({operation:'search',index:request.index,pipeline:request.search_pipeline,query:request.body.query.hybrid.queries[0].multi_match.query});
        return {body:{hits:{hits:[]}}};
      },
      transport: {request:async request => {
        record({operation:'transport',method:request.method,path:request.path});
        if(request.method==='GET' && request.path.startsWith('/_plugins/_ml/models/')) return {body:{connector_id:'offline-connector'}};
        if(request.method==='GET' && request.path.startsWith('/_plugins/_ml/connectors/')) return {body:{protocol:'aws_sigv4',parameters:{region:config.AWS_REGION,service_name:'bedrock',model:'amazon.titan-embed-text-v2:0',dimensions:1024,normalize:true}}};
        if(request.method==='GET') throw Object.assign(new Error('missing'),{statusCode:404});
        if(request.path.endsWith('/_simulate')) return {body:{docs:[{doc:{_source:{embedding:Array(1024).fill(0.1)}}}]}};
        return {body:{acknowledged:true}};
      }}
    };
  }
}};
`);
  const environment = { ...process.env, ...setupConfig, SF_TARGET_ORG: "wrong-default-org", SF_CANDIDATE_RECORD_TYPES: "Candidate", SF_TAG_TYPE_MAP: "{}", AWS_PROFILE: "offline" };
  const command = (script: string, args: string[]) => run(process.execPath,
    ["--import", "tsx", "--import", pathToFileURL(preload).href, `backend/host/cli/${script.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}.ts`, ...args],
    { env: environment, windowsHide: true, timeout: 30_000, maxBuffer: 2_000_000 });
  const output = join(directory, "export");
  const fetchArgs = ["--org", "full", "--output-dir", output, "--batch-size", "1000", "--max-batches", "1"];
  const first = await command("fetch-candidates", fetchArgs);
  assert.match(first.stdout, /Saved batch 1: 1000 records/);
  assert.match(first.stdout, /Export paused/);
  const second = await command("fetch-candidates", [...fetchArgs, "--resume"]);
  assert.match(second.stdout, /Saved batch 2: 3 records/);
  assert.match(second.stdout, /Export complete: 1003 records in 2 files/);
  assert.equal(queries.length, 2);
  assert.match(queries[1], /AND Id > '003000000001000'/);
  const checkpoint = JSON.parse(await readFile(join(output, "checkpoint.json"), "utf8"));
  assert.equal(checkpoint.sourceId, "offline-full-org");
  assert.equal(checkpoint.org, "full");
  const setup = await command("setup-opensearch", ["--index", "candidates-fsb"]);
  assert.match(setup.stdout, /OpenSearch candidate setup complete/);
  await writeFile(join(output, ".export.lock"), JSON.stringify({ pid: process.pid }));
  await assert.rejects(command("index-candidates", ["--source", "json", "--file", join(output, "batch-000001.json"), "--index", "candidates-fsb"]),
    (error: any) => /Dataset is locked/.test(error.stderr));
  await rm(join(output, ".export.lock"));
  for (const file of ["batch-000001.json", "batch-000002.json", "batch-000001.json"]) {
    const result = await command("index-candidates", ["--source", "json", "--file", join(output, file), "--index", "candidates-fsb"]);
    assert.match(result.stdout, /Index candidates-fsb: \d+\/\d+ processed/);
  }
  const search = await command("search", ["--index", "candidates-fsb", "Java Spring Boot"]);
  assert.match(search.stdout, /OpenSearch index: candidates-fsb/);
  const requests = (await readFile(log, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.ok(requests.filter((r) => r.operation === "configuration").every((r) => r.index === "candidates-fsb"));
  assert.ok(requests.some((r) => r.operation === "create" && r.index === "candidates-fsb"));
  const bulk = requests.filter((r) => r.operation === "bulk");
  assert.equal(bulk.length, 21);
  assert.ok(bulk.every((r) => r.pipeline === "candidates-fsb-ingest" && r.index === "candidates-fsb" && r.ids.length <= 100));
  assert.equal(new Set(bulk.flatMap((r) => r.ids)).size, 1003);
  assert.ok(requests.some((r) => r.path === "/_ingest/pipeline/candidates-fsb-ingest" && r.method === "PUT"));
  assert.ok(requests.some((r) => r.path === "/_search/pipeline/candidates-fsb-hybrid" && r.method === "PUT"));
  assert.ok(requests.some((r) => r.operation === "search" && r.pipeline === "candidates-fsb-hybrid" && r.query === "Java Spring Boot"));
  assert.equal(environment.OPENSEARCH_INDEX, config.OPENSEARCH_INDEX);
});
