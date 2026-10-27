// Test-only substitutions for Salesforce and AWS. Production does not import this module.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SalesforceCliCommand } from "../../infrastructure/salesforce/salesforce-cli-command";
import { SalesforceQueryClient } from "../../infrastructure/salesforce/salesforce-query-client";
import { OpenSearchConfig } from "../../infrastructure/config/opensearch-config";
import { metadataFields, candidateRecordType, systemRecordType } from "../salesforce-profile-fixtures";
SalesforceQueryClient.prototype.describe = async function(object: string) {
  return { queryable: true, fields: metadataFields[object].map((name) => ({ name, type: "string" })) };
};
SalesforceQueryClient.prototype.query = async function(query: string) {
  if (query.includes("FROM RecordType")) return [
    { Id: candidateRecordType, DeveloperName: "Candidate", SobjectType: "Contact" },
    { Id: "012000000000003", DeveloperName: "CandidatePreReg", SobjectType: "Contact" },
    { Id: systemRecordType, DeveloperName: "Systems", SobjectType: "Tag__c" },
  ] as never;
  if (query.includes("FROM TagAssociation__c")) {
    const ids = [...query.matchAll(/'(003\d+)'/g)].map((match) => match[1]).filter((id) => Number(id.slice(3)) % 10 !== 0);
    return ids.map((id) => ({ Id: "a010" + id.slice(4), candidate__c: id, firstTag__c: "a02000000000001" })) as never;
  }
  if (query.includes("FROM Tag__c")) return [{ Id: "a02000000000001", Name: "Java", label__c: "Java", RecordTypeId: systemRecordType }] as never;
  return [] as never;
};
const delay = (ms: number) => new Promise((done) => setTimeout(done, ms));
SalesforceCliCommand.prototype.execute = function(args: string[]) {
  return JSON.stringify({ status: 0, result: args.includes("display") ? { instanceUrl: "https://offline.invalid", id: "offline-full-org" } : { accessToken: "offline-token" } });
};
SalesforceQueryClient.prototype.queryBatch = async function(query: string) {
  await delay(350);
  const start = Number(/Id > '003(\d+)'/.exec(query)?.[1] ?? "0") + 1;
  const limit = Number(/LIMIT (\d+)/.exec(query)?.[1]);
  return Array.from({ length: Math.max(0, Math.min(limit, 1005 - start + 1)) }, (_, offset) => {
    const number = start + offset; const blank = number % 10 === 0;
    return { Id: "003" + String(number).padStart(12, "0"), Name: ["Maya Chen", "Arjun Patel", "Sofia Tanaka", "Daniel Kim", "Ava Williams"][(number - 1) % 5] + " " + number,
      Title: blank ? "" : ["Backend Engineer", "Staff Software Engineer", "Full Stack Developer"][(number - 1) % 3], Account: { Name: "Example Studio" },
      TagConnector__r: { SkillCode1__c: blank ? "" : "Java", SkillCode2__c: blank ? "" : "Spring Boot", Systems1__c: blank ? "" : "Kafka" } };
  }) as never;
};
const awsModule = require.resolve("../../infrastructure/opensearch/open-search-serverless-client");
require(awsModule);
require.cache[awsModule]!.exports = { OpenSearchServerlessClient: class {
  readonly connection;
  constructor(config: OpenSearchConfig) {
    const directory = join(process.cwd(), ".cache/offline-index"); const path = join(directory, config.OPENSEARCH_INDEX + ".json");
    const read = async (): Promise<Record<string, unknown>> => { try { return JSON.parse(await readFile(path, "utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; } };
    this.connection = {
      close: async () => {}, indices: { exists: async () => ({ body: false }), create: async () => ({ body: { acknowledged: true } }),
        getMapping: async () => ({ body: { [config.OPENSEARCH_INDEX]: { mappings: { _meta: { schema_version: 3 }, properties: { enrichment: { type: "object", enabled: false } } } } } }) },
      bulk: async (request: { body: any[] }) => {
        await delay(100); const documents = await read();
        for (let index = 0; index < request.body.length; index += 2) documents[request.body[index].index._id] = request.body[index + 1];
        await mkdir(directory, { recursive: true }); await writeFile(path, JSON.stringify(documents));
        return { body: { errors: false, items: Array.from({ length: request.body.length / 2 }, () => ({ index: { status: 200 } })) } };
      },
      search: async (request: { body: any }) => {
        await delay(250);
        const query = request.body.query.hybrid.queries[0].multi_match.query;
        if (query === "simulate failure") throw new Error("Offline fixture: search request failed");
        const entries = Object.entries(await read()).slice(0, request.body.size);
        return { body: { hits: { hits: entries.map(([id, source], index) => ({ _id: id, _score: 0.98 - index * 0.021, _source: source })) } } };
      },
      transport: { request: async (request: { method: string; path: string }) => {
        if (request.method === "GET" && request.path.startsWith("/_plugins/_ml/models/")) return { body: { connector_id: "offline-connector" } };
        if (request.method === "GET" && request.path.startsWith("/_plugins/_ml/connectors/")) return { body: { protocol: "aws_sigv4", parameters: { region: config.AWS_REGION, service_name: "bedrock", model: "amazon.titan-embed-text-v2:0", dimensions: 1024, normalize: true } } };
        if (request.method === "GET") throw Object.assign(new Error("missing"), { statusCode: 404 });
        if (request.path.endsWith("/_simulate")) return { body: { docs: [{ doc: { _source: { embedding: Array(1024).fill(0.1) } } }] } };
        return { body: { acknowledged: true } };
      } },
    };
  }
} };
