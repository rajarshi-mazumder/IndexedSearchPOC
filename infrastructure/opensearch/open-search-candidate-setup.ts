import { API, Client } from "@opensearch-project/opensearch";
import { z } from "zod";
import { OpenSearchSetupConfig } from "../config/opensearch-config";
import mapping from "./config/candidate-index.json";
import searchPipeline from "./config/candidate-hybrid-search-pipeline.json";
import { CANDIDATE_SCHEMA_VERSION, TITAN_DIMENSIONS, TITAN_MODEL_ID } from "./titan-embedding-config";

export class OpenSearchCandidateSetup {
  constructor(
    private readonly client: Client,
    private readonly config: OpenSearchSetupConfig,
    private readonly model: { ensure(): Promise<string> },
  ) {}

  async execute(): Promise<string> {
    const index = this.config.OPENSEARCH_INDEX;
    const exists = (await this.client.indices.exists({ index })).body;
    const existingMapping = exists ? (await this.client.indices.getMapping({ index })).body[index]?.mappings : undefined;
    if (exists) {
      // Reject old BGE indexes before changing any pipeline or registering a model.
      const compatibility = z.object({
        _meta: z.object({ schema_version: z.literal(CANDIDATE_SCHEMA_VERSION), embedding_model: z.literal(TITAN_MODEL_ID) }),
        properties: z.object({
          embedding: z.object({ type: z.literal("knn_vector"), dimension: z.literal(TITAN_DIMENSIONS) }),
          searchText: z.object({ type: z.literal("text") }),
        }),
      }).safeParse(existingMapping);
      if (!compatibility.success) {
        throw new Error("Incompatible candidate index. Choose a new OPENSEARCH_INDEX and reindex candidates.", { cause: compatibility.error });
      }
    }

    const modelId = await this.model.ensure();
    if (exists && existingMapping?._meta?.embedding_model_id !== modelId) {
      throw new Error("The index uses a different embedding model. Choose a new OPENSEARCH_INDEX and reindex candidates.");
    }
    try {
      const response = await this.client.transport.request({
        method: "GET", path: "/_ingest/pipeline/" + this.config.OPENSEARCH_INGEST_PIPELINE,
      });
      const existingPipeline = response.body[this.config.OPENSEARCH_INGEST_PIPELINE];
      const processor = existingPipeline?.processors?.find((item: { text_embedding?: unknown }) => item.text_embedding)?.text_embedding;
      if (processor?.model_id !== modelId || processor?.field_map?.searchText !== "embedding") {
        throw new Error("The ingest pipeline has different embedding settings. Choose a new OPENSEARCH_INGEST_PIPELINE.");
      }
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) throw error;
    }
    const ingestPipeline = {
      description: "Generate candidate vectors with Amazon Bedrock Titan V2",
      processors: [{ text_embedding: {
        model_id: modelId, field_map: { searchText: "embedding" }, batch_size: 1,
      } }],
    };
    // Test the actual remote inference before installing or changing runtime resources.
    const simulation = await this.client.transport.request({
      method: "POST", path: "/_ingest/pipeline/_simulate",
      body: { pipeline: ingestPipeline, docs: [{ _source: { searchText: "Skills: TypeScript, OpenSearch" } }] },
    });
    z.object({ docs: z.array(z.object({ doc: z.object({ _source: z.object({
      embedding: z.array(z.number().finite()).length(TITAN_DIMENSIONS),
    }) }) })).length(1) }).parse(simulation.body);

    await this.client.transport.request({
      method: "PUT", path: "/_ingest/pipeline/" + this.config.OPENSEARCH_INGEST_PIPELINE,
      body: ingestPipeline,
    });
    await this.client.transport.request({
      method: "PUT", path: "/_search/pipeline/" + this.config.OPENSEARCH_SEARCH_PIPELINE,
      body: searchPipeline,
    });
    const settings = { "index.default_pipeline": this.config.OPENSEARCH_INGEST_PIPELINE };
    if (!exists) {
      await this.client.indices.create({
        index,
        body: {
          settings: { ...mapping.settings, ...settings },
          mappings: {
            ...mapping.mappings as API.Indices_Create_RequestBody["mappings"],
            _meta: { schema_version: CANDIDATE_SCHEMA_VERSION, embedding_model: TITAN_MODEL_ID, embedding_model_id: modelId },
          },
        },
      });
    } else {
      await this.client.indices.putSettings({ index, body: settings });
    }
    return modelId;
  }
}
