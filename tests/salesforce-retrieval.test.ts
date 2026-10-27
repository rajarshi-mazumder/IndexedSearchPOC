import assert from "node:assert/strict";
import { test } from "node:test";
import { Connection } from "jsforce";
import { SalesforceQueryClient } from "../infrastructure/salesforce/salesforce-query-client";
import { SalesforceCandidateRepository } from "../infrastructure/salesforce/salesforce-candidate-repository";
import { SalesforceCliAuthentication } from "../infrastructure/salesforce/salesforce-cli-authentication";
import { loadSalesforceConfig } from "../infrastructure/config/salesforce-config";
import { profileClient, profileRepository } from "./salesforce-profile-fixtures";

test("Salesforce retrieval follows every query continuation", async () => {
  const locators: string[] = [];
  const pages = [
    { records: [{ Id: "first" }], done: false, nextRecordsUrl: "/services/data/v65.0/query/second" },
    { records: [{ Id: "second" }], done: false, nextRecordsUrl: "/services/data/v65.0/query/third" },
    { records: [{ Id: "third" }], done: true },
  ];
  const connection = {
    version: "65.0", request: async ({ url }: { url: string }) => { locators.push(url); return pages.shift(); },
  } as unknown as Connection;
  assert.deepEqual(await new SalesforceQueryClient(connection).query("SELECT Id FROM Contact"),
    [{ Id: "first" }, { Id: "second" }, { Id: "third" }]);
  assert.deepEqual(locators.slice(1), ["/services/data/v65.0/query/second", "/services/data/v65.0/query/third"]);
});

test("a missing Salesforce continuation fails instead of silently truncating", async () => {
  const connection = { request: async () => ({ records: [{ Id: "first" }], done: false }) } as unknown as Connection;
  await assert.rejects(new SalesforceQueryClient(connection).query("SELECT Id FROM Contact"), /continuation URL/);
});

test("a failed later Salesforce page propagates", async () => {
  let calls = 0;
  const connection = {
    request: async () => {
      if (++calls > 1) throw new Error("Salesforce outage");
      return { records: [{ Id: "first" }], done: false, nextRecordsUrl: "/services/data/v65.0/query/second" };
    },
  } as unknown as Connection;
  await assert.rejects(new SalesforceQueryClient(connection).query("SELECT Id FROM Contact"), /outage/);
});

test("partial retrieval validates IDs and groups large selections into queries", async () => {
  const queries: string[] = [];
  const client = { query: async (query: string) => { queries.push(query); return []; } } as unknown as SalesforceQueryClient;
  const repository = profileRepository(profileClient((soql) => client.query(soql)));
  const ids = Array.from({ length: 201 }, (_, i) => "003" + String(i).padStart(12, "0"));
  await repository.getByIds(ids);
  assert.equal(queries.length, 2);
  assert.match(queries[0], /RecordTypeId IN/);
  assert.match(queries[1], new RegExp(ids[200]));
  await assert.rejects(repository.getByIds(["bad' OR Name != '"]));
  assert.equal(queries.length, 2);
});

test("Salesforce CLI authentication uses the configured org alias", () => {
  const calls: string[][] = [];
  const auth = new SalesforceCliAuthentication("prototype-org", (args) => {
    calls.push(args);
    return JSON.stringify(args.includes("display") ?
      { status: 0, result: { instanceUrl: "https://salesforce.invalid" } } :
      { status: 0, result: { accessToken: "offline-token" } });
  });
  const connection = auth.createConnection();
  assert.equal(connection.instanceUrl, "https://salesforce.invalid");
  assert.equal(connection.accessToken, "offline-token");
  assert.deepEqual(calls, [
    ["org", "display", "--target-org", "prototype-org", "--json"],
    ["org", "auth", "show-access-token", "--json", "-o", "prototype-org"],
  ]);
  assert.throws(() => loadSalesforceConfig({ SF_TARGET_ORG: "org & command" }));
});

test("export authentication exposes the actual org identity for resume validation", () => {
  const auth = new SalesforceCliAuthentication("full", (args) => JSON.stringify({ status: 0, result: args.includes("display")
    ? { instanceUrl: "https://offline.invalid", id: "00D000000000001" } : { accessToken: "offline-token" } }));
  const session = auth.createSession();
  assert.equal(session.sourceId, "00D000000000001");
  assert.equal(session.connection.instanceUrl, "https://offline.invalid");
});
