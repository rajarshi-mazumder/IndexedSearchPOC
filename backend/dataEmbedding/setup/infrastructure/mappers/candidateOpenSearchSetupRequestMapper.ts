import { API } from "@opensearch-project/opensearch";
import { OpenSearchSetupConfig } from "../../../../infrastructure/config/opensearchConfig";
import { CANDIDATE_SCHEMA_VERSION, TITAN_MODEL_ID } from "../../../../infrastructure/opensearch/titanEmbeddingConfig";
import mapping from "../config/candidateIndex.json";

/** Pure SDK payload construction, kept outside the application layer. */
export class CandidateOpenSearchSetupRequestMapper {
  public constructor(private readonly config: OpenSearchSetupConfig) {}

  public createIngestPipeline(modelId: string) {
    return {
      description: "Generate candidate vectors with Amazon Bedrock Titan V2",
      processors: [{ text_embedding: {
        model_id: modelId,
        field_map: { searchText: "embedding" },
        batch_size: 1,
      } }],
    };
  }

  public createSimulationRequest(modelId: string) {
    return {
      method: "POST",
      path: "/_ingest/pipeline/_simulate",
      body: {
        pipeline: this.createIngestPipeline(modelId),
        docs: [{ _source: { searchText: "Skills: TypeScript, OpenSearch" } }],
      },
    };
  }

  public createIngestPipelineRequest(modelId: string) {
    return {
      method: "PUT",
      path: "/_ingest/pipeline/" + this.config.OPENSEARCH_INGEST_PIPELINE,
      body: this.createIngestPipeline(modelId),
    };
  }

  public createSearchPipelineRequest(searchPipeline: Record<string, unknown>) {
    return {
      method: "PUT",
      path: "/_search/pipeline/" + this.config.OPENSEARCH_SEARCH_PIPELINE,
      body: searchPipeline,
    };
  }

  public createIndexRequest(modelId: string): API.Indices_Create_Request {
    return {
      index: this.config.OPENSEARCH_INDEX,
      body: {
        settings: { ...mapping.settings, ...this.createDefaultPipelineSettings() },
        mappings: {
          ...mapping.mappings as API.Indices_Create_RequestBody["mappings"],
          _meta: {
            schema_version: CANDIDATE_SCHEMA_VERSION,
            embedding_model: TITAN_MODEL_ID,
            embedding_model_id: modelId,
          },
        },
      },
    };
  }

  public createIndexSettingsRequest() {
    return {
      index: this.config.OPENSEARCH_INDEX,
      body: this.createDefaultPipelineSettings(),
    };
  }

  private createDefaultPipelineSettings() {
    return { "index.default_pipeline": this.config.OPENSEARCH_INGEST_PIPELINE };
  }
}
