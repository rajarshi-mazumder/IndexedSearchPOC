import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import responses from "../e2e/fixtures/input/search-responses.json";

const workspace = process.cwd();
const log = (service: string, operation: string, request: unknown) => appendFileSync(join(workspace, "boundary-requests.jsonl"), JSON.stringify({ service, operation, request }) + "\n");
const readState = (file: string, fallback: any = {}) => existsSync(join(workspace, file)) ? JSON.parse(readFileSync(join(workspace, file), "utf8")) : fallback;
const saveState = (file: string, data: unknown) => writeFileSync(join(workspace, file), JSON.stringify(data));
const control = () => readState("fault.json");

export class OfflineContractOpenSearchClient {
  readonly connection: any;
  constructor(config: any) {
    const stateFile = "opensearch-state.json";
    const state = () => readState(stateFile, { indices: {}, pipelines: {}, documents: {} });
    const missing = () => { throw Object.assign(new Error("Fixture missing resource"), { statusCode: 404 }); };
    log("opensearch", "configuration", config);
    let bulkAttempt = 0;
    this.connection = {
      close: async () => {},
      indices: {
        exists: async (request: any) => { log("opensearch", "indices.exists", request); return { body: !!state().indices[request.index] }; },
        create: async (request: any) => { log("opensearch", "indices.create", request); const data = state(); data.indices[request.index] = request.body; saveState(stateFile, data); return { body: { acknowledged: true } }; },
        getMapping: async (request: any) => { log("opensearch", "indices.getMapping", request); const mapping = state().indices[request.index]; return { body: { [request.index]: mapping ?? missing() } }; },
        putSettings: async (request: any) => { log("opensearch", "indices.putSettings", request); const data = state(); data.indices[request.index].settings = request.body; saveState(stateFile, data); return { body: { acknowledged: true } }; },
      },
      bulk: async (request: any) => {
        log("opensearch", "bulk", request); bulkAttempt++;
        const fault = control(), data = state(), items = [];
        if (fault.bulkDelay) await new Promise((done) => setTimeout(done, fault.bulkDelay));
        for (let position = 0; position < request.body.length;) {
          const action = request.body[position], kind = action.index ? "index" : "delete";
          const { _id: id, _index: index } = action[kind];
          const rejected = fault.rejectId === id && (!fault.onlyFirstAttempt || bulkAttempt === 1);
          if (rejected) items.push({ [kind]: { status: fault.status ?? 429, error: { reason: "Fixture bulk rejection" } } });
          else {
            const documents = data.documents[index] ??= {};
            if (kind === "index") documents[id] = request.body[position + 1];
            else delete documents[id];
            items.push({ [kind]: { status: 200 } });
          }
          position += kind === "index" ? 2 : 1;
        }
        saveState(stateFile, data);
        return { body: { errors: items.some((item) => Object.values(item).some((value: any) => value.status >= 400)), items: fault.incomplete ? items.slice(1) : items } };
      },
      search: async (request: any) => {
        log("opensearch", "search", request);
        const fault = control();
        if (fault.searchError) throw new Error("Fixture search unavailable");
        const documents = state().documents[request.index] ?? {};
        const hits = responses.hits.filter((hit) => documents[hit.id]).slice(0, request.body.size)
          .map((hit) => ({ _id: hit.id, _score: hit.score, _source: { ...documents[hit.id], embedding: [0.123] } }));
        return { body: { timed_out: !!fault.timedOut, _shards: { failed: fault.failedShards ?? 0 }, hits: { hits } } };
      },
      transport: { request: async (request: any) => {
        log("opensearch", "transport", request);
        const data = state();
        if (request.path.endsWith("/_search") && request.path.startsWith("/_plugins/_ml/")) return { body: { hits: { hits: [] } } };
        if (request.path.endsWith("/_create")) return { body: { connector_id: "fixture-connector" } };
        if (request.path.endsWith("/_register")) return { body: { model_id: "fixture-model" } };
        if (request.path.startsWith("/_plugins/_ml/models/")) return { body: { connector_id: "fixture-connector" } };
        if (request.path.startsWith("/_plugins/_ml/connectors/")) return { body: { protocol: "aws_sigv4", parameters: { region: "ap-northeast-1", service_name: "bedrock", model: "amazon.titan-embed-text-v2:0", dimensions: 1024, normalize: true } } };
        if (request.path.endsWith("/_simulate")) return { body: { docs: [{ doc: { _source: { embedding: Array(control().invalidVector ? 2 : 1024).fill(0.1) } } }] } };
        if (request.method === "GET") return { body: data.pipelines[request.path] ?? missing() };
        if (request.method === "PUT") {
          data.pipelines[request.path] = { [request.path.split("/").at(-1)]: request.body }; saveState(stateFile, data);
          return { body: { acknowledged: true } };
        }
        throw new Error("Unhandled OpenSearch request: " + JSON.stringify(request));
      } },
    };
  }
}
