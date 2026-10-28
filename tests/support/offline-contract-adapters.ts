/** External boundaries only. Real preparation, CV generation, serialization,
 * indexing, query construction, response mapping and workers run unchanged. */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Connection } from "jsforce";
import * as net from "node:net";
import { SalesforceCliCommand, openSearchClientModule } from "./current-backend-bindings";
import fixture from "../e2e/fixtures/input/salesforce.json";
import { OfflineContractOpenSearchClient } from "./offline-contract-open-search-client";

const fixedTime = Date.parse("2026-10-28T00:00:00.000Z");
const OriginalDate = Date;
globalThis.Date = new Proxy(OriginalDate, {
  construct: (target, args) => Reflect.construct(target, args.length ? args : [fixedTime]),
  get: (target, key) => key === "now" ? () => fixedTime : Reflect.get(target, key),
});
// Fail closed: a missed adapter must never contact a real service.
net.Socket.prototype.connect = function(): never { throw new Error("Contract worker attempted network access"); };
globalThis.fetch = async () => { throw new Error("Contract worker attempted fetch"); };

const workspace = process.cwd();
const log = (service: string, operation: string, request: unknown) => appendFileSync(join(workspace, "boundary-requests.jsonl"), JSON.stringify({ service, operation, request }) + "\n");
const readState = (file: string, fallback: any = {}) => existsSync(join(workspace, file)) ? JSON.parse(readFileSync(join(workspace, file), "utf8")) : fallback;
const control = () => readState("fault.json");
let callNumber = 0;
const continuations = new Map<string, Record<string, unknown>[]>();
const table = fixture.records as Record<string, Record<string, any>[]>;

SalesforceCliCommand.prototype.execute = function(args) {
  log("salesforce", "cli", args);
  return JSON.stringify({ status: 0, result: args.includes("display") ? { instanceUrl: "https://fixture.invalid", id: "fixture-org" } : { accessToken: "fixture-token" } });
};
Connection.prototype.request = (async function(input: { method: string; url: string }, options: unknown) {
  log("salesforce", "request", { ...input, options });
  const fault = control();
  if (fault.sfDelay) await new Promise((done) => setTimeout(done, fault.sfDelay));
  const url = new URL(input.url, "https://fixture.invalid");
  const described = /sobjects\/(\w+)\/describe$/.exec(url.pathname)?.[1];
  if (described) {
    const fields = (fixture.metadata as Record<string, unknown>)[described];
    if (!fields) throw new Error("Unexpected describe: " + described);
    return { queryable: true, fields };
  }
  let rows: Record<string, unknown>[];
  if (url.searchParams.has("q")) {
    const query = url.searchParams.get("q")!;
    const object = / FROM (\w+)/.exec(query)?.[1];
    if (!object || !table[object]) throw new Error("Unexpected query: " + query);
    if (fault.sfFailObject === object) throw new Error("Fixture Salesforce failure: " + object);
    rows = table[object].filter((row) => {
      for (const match of query.matchAll(/(\w+) IN \(([^)]+)\)/g)) {
        const allowed = [...match[2].matchAll(/'([^']*)'/g)].map((item) => item[1]);
        if (!allowed.includes(String(row[match[1]]))) return false;
      }
      const after = /Id > '([^']+)'/.exec(query)?.[1];
      return !after || row.Id > after;
    });
    if (query.includes("ORDER BY Id ASC")) rows.sort((a, b) => String(a.Id).localeCompare(String(b.Id)));
    const limit = /LIMIT (\d+)/.exec(query)?.[1];
    if (limit) rows = rows.slice(0, Number(limit));
    const fields = query.slice("SELECT ".length, query.indexOf(" FROM ")).split(",").map((field) => field.trim());
    rows = rows.map((row) => Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field]])));
  } else {
    if (!continuations.has(url.pathname)) throw new Error("Unknown continuation: " + url.pathname);
    rows = continuations.get(url.pathname)!;
  }
  // Deliberately short external pages exercise real continuation handling.
  const first = rows.slice(0, 2), remaining = rows.slice(2);
  if (!remaining.length) return { done: true, records: first };
  const nextRecordsUrl = `/services/data/v65.0/query/fixture-${++callNumber}`;
  continuations.set(nextRecordsUrl, remaining);
  return { done: false, records: first, nextRecordsUrl };
}) as any;


require(openSearchClientModule);
require.cache[openSearchClientModule]!.exports = { OpenSearchServerlessClient: OfflineContractOpenSearchClient };
