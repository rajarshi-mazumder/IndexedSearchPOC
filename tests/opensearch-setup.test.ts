import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@opensearch-project/opensearch";
import { SetupCandidateOpenSearchResourcesTestDriver as OpenSearchCandidateSetup } from "./support/setupCandidateOpenSearchResourcesTestDriver";
import { EnsureCandidateEmbeddingModelTestDriver as OpenSearchBedrockModel } from "./support/ensureCandidateEmbeddingModelTestDriver";
import { CANDIDATE_SCHEMA_VERSION, TITAN_DIMENSIONS, TITAN_MODEL_ID } from "../backend/infrastructure/opensearch/titanEmbeddingConfig";
import { loadOpenSearchConfig, loadOpenSearchSetupConfig } from "../backend/infrastructure/config/opensearchConfig";
import { config, setupConfig } from "./candidate-fixtures";

function setupDouble(options: { exists?: boolean; modelId?: string; dimension?: number; simulationDimension?: number; pipelineModelId?: string } = {}) {
  const calls: any[] = [];
  const existing = {
    _meta: { schema_version: CANDIDATE_SCHEMA_VERSION, embedding_model: TITAN_MODEL_ID, embedding_model_id: options.modelId ?? "test-model" },
    properties: { embedding: { type: "knn_vector", dimension: options.dimension ?? TITAN_DIMENSIONS }, searchText: { type: "text" } },
  };
  const client = {
    transport: { request: async (request: any) => {
      calls.push(request);
      if (request.method === "GET") {
        if (!options.pipelineModelId) throw Object.assign(new Error("missing pipeline"), { statusCode: 404 });
        return { body: { [config.OPENSEARCH_INGEST_PIPELINE]: { processors: [{ text_embedding: {
          model_id: options.pipelineModelId, field_map: { searchText: "embedding" },
        } }] } } };
      }
      if (request.path.endsWith("_simulate")) {
        return { body: { docs: [{ doc: { _source: { embedding: Array(options.simulationDimension ?? TITAN_DIMENSIONS).fill(0.1) } } }] } };
      }
      return { body: { acknowledged: true } };
    } },
    indices: {
      exists: async () => ({ body: options.exists ?? false }),
      getMapping: async () => ({ body: { [config.OPENSEARCH_INDEX]: { mappings: existing } } }),
      create: async (request: any) => { calls.push({ operation: "create", ...request }); },
      putSettings: async (request: any) => { calls.push({ operation: "settings", ...request }); },
    },
  } as unknown as Client;
  return { client, calls };
}

test("setup verifies remote vectors and installs matching ingest, search and index configuration", async () => {
  const { client, calls } = setupDouble();
  const id = await new OpenSearchCandidateSetup(client, setupConfig, { ensure: async () => "test-model" }).execute();
  assert.equal(id, "test-model");
  const simulation = calls.find((call) => call.path?.endsWith("_simulate"));
  assert.equal(simulation.body.pipeline.processors[0].text_embedding.model_id, id);
  const ingest = calls.find((call) => call.method === "PUT" && call.path.includes("_ingest"));
  assert.deepEqual(ingest.body.processors[0].text_embedding.field_map, { searchText: "embedding" });
  assert.equal(ingest.body.processors[0].text_embedding.batch_size, 1);
  const search = calls.find((call) => call.method === "PUT" && call.path.includes("_search"));
  const processor = search.body.phase_results_processors[0]["normalization-processor"];
  assert.equal(processor.normalization.technique, "min_max");
  assert.deepEqual(processor.combination.parameters.weights, [0.25, 0.75]);
  const index = calls.find((call) => call.operation === "create");
  assert.equal(index.body.mappings.properties.embedding.dimension, TITAN_DIMENSIONS);
  assert.equal(index.body.mappings._meta.embedding_model_id, id);
  assert.equal(index.body.settings["index.default_pipeline"], config.OPENSEARCH_INGEST_PIPELINE);
  assert.equal(index.body.settings["index.knn.remote_index_build.enabled"], false);
});

test("an existing BGE index is rejected before any model or pipeline mutation", async () => {
  const { client, calls } = setupDouble({ exists: true, dimension: 768 });
  let registered = false;
  await assert.rejects(new OpenSearchCandidateSetup(client, setupConfig, {
    ensure: async () => { registered = true; return "test-model"; },
  }).execute(), /Incompatible candidate index/);
  assert.equal(registered, false);
  assert.deepEqual(calls, []);
});

test("an existing index cannot silently switch its embedding model", async () => {
  const { client, calls } = setupDouble({ exists: true, modelId: "previous-model" });
  await assert.rejects(new OpenSearchCandidateSetup(client, setupConfig, {
    ensure: async () => "test-model",
  }).execute(), /different embedding model/);
  assert.deepEqual(calls, []);
});

test("a shared ingest pipeline cannot silently switch its embedding model", async () => {
  const { client, calls } = setupDouble({ pipelineModelId: "previous-model" });
  await assert.rejects(new OpenSearchCandidateSetup(client, setupConfig, {
    ensure: async () => "test-model",
  }).execute(), /different embedding settings/);
  assert.equal(calls.filter((call) => call.method === "PUT").length, 0);
});

test("invalid remote vectors stop setup before installing runtime resources", async () => {
  const { client, calls } = setupDouble({ simulationDimension: 768 });
  await assert.rejects(new OpenSearchCandidateSetup(client, setupConfig, { ensure: async () => "test-model" }).execute());
  assert.equal(calls.filter((call) => call.method === "PUT" || call.operation === "create").length, 0);
});

test("compatible setup reruns preserve the index", async () => {
  const { client, calls } = setupDouble({ exists: true, pipelineModelId: "test-model" });
  await new OpenSearchCandidateSetup(client, setupConfig, { ensure: async () => "test-model" }).execute();
  assert.equal(calls.filter((call) => call.operation === "create").length, 0);
  assert.equal(calls.filter((call) => call.operation === "settings").length, 1);
});

test("new remote model registration uses an IAM role and Titan V2 for 1024 dimensions", async () => {
  const calls: any[] = [];
  const client = { transport: { request: async (request: any) => {
    calls.push(request);
    if (request.path.endsWith("_search")) return { body: { hits: { hits: [] } } };
    if (request.path.endsWith("_create")) return { body: { connector_id: "connector" } };
    if (request.path.endsWith("_register")) return { body: { model_id: "registered-model" } };
    throw new Error("Unexpected operation: " + request.path);
  } } } as unknown as Client;
  const model = new OpenSearchBedrockModel(client, { ...setupConfig, OPENSEARCH_MODEL_ID: undefined });
  assert.equal(await model.ensure(), "registered-model");
  const connector = calls.find((call) => call.path.endsWith("_create")).body;
  assert.deepEqual(connector.credential, { roleArn: setupConfig.BEDROCK_ROLE_ARN });
  assert.equal(connector.parameters.model, TITAN_MODEL_ID);
  assert.equal(connector.parameters.dimensions, 1024);
  assert.match(connector.actions[0].request_body, /inputText/);
  assert.equal(calls.find((call) => call.path.endsWith("_register")).body.connector_id, "connector");
  assert.equal(calls.some((call) => call.path.endsWith("_deploy")), false);
});

test("existing model reuse validates its embedding configuration without mutations", async () => {
  const calls: any[] = [];
  const client = { transport: { request: async (request: any) => {
    calls.push(request);
    return request.path.includes("/models/") ? { body: { connector_id: "connector" } } : {
      body: { protocol: "aws_sigv4", parameters: {
        region: config.AWS_REGION, service_name: "bedrock", model: TITAN_MODEL_ID,
        dimensions: "1024", normalize: "true",
      } },
    };
  } } } as unknown as Client;
  assert.equal(await new OpenSearchBedrockModel(client, setupConfig).ensure(), config.OPENSEARCH_MODEL_ID);
  assert.ok(calls.every((call) => call.method === "GET"));
});

test("configuration allows setup without a model ID but requires it at runtime", () => {
  const environment = { ...setupConfig, OPENSEARCH_MODEL_ID: "" };
  assert.equal(loadOpenSearchSetupConfig(environment).OPENSEARCH_MODEL_ID, undefined);
  assert.throws(() => loadOpenSearchConfig(environment));
  assert.deepEqual(loadOpenSearchConfig(config), config);
  const nextGen = "https://example.aoss.ap-northeast-1.on.aws";
  assert.equal(loadOpenSearchConfig({ ...config, OPENSEARCH_NODE: nextGen }).OPENSEARCH_NODE, nextGen);
  assert.throws(() => loadOpenSearchConfig({ ...config, OPENSEARCH_NODE: "https://unrelated.on.aws" }));
  assert.throws(() => loadOpenSearchConfig({ ...config, OPENSEARCH_NODE: "https://user:password@example.com" }));
});
