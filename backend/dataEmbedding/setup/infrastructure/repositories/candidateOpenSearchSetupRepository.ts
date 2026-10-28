import { Client } from "@opensearch-project/opensearch";
import { z } from "zod";
import { OpenSearchSetupConfig } from "../../../../infrastructure/config/opensearchConfig";
import { CANDIDATE_SCHEMA_VERSION, TITAN_DIMENSIONS, TITAN_MODEL_ID } from "../../../../infrastructure/opensearch/titanEmbeddingConfig";
import { CandidateIndexState, CandidateOpenSearchResources } from "../../application/ports/candidateOpenSearchResources";
import { CandidateOpenSearchSetupRequestMapper } from "../mappers/candidateOpenSearchSetupRequestMapper";

const compatibleMappingSchema = z.object({
  _meta: z.object({ schema_version: z.literal(CANDIDATE_SCHEMA_VERSION), embedding_model: z.literal(TITAN_MODEL_ID) }),
  properties: z.object({
    embedding: z.object({ type: z.literal("knn_vector"), dimension: z.literal(TITAN_DIMENSIONS) }),
    searchText: z.object({ type: z.literal("text") }),
  }),
});

const simulationSchema = z.object({
  docs: z.array(z.object({ doc: z.object({ _source: z.object({
    embedding: z.array(z.number().finite()).length(TITAN_DIMENSIONS),
  }) }) })).length(1),
});

interface TextEmbeddingProcessor {
  model_id?: unknown;
  field_map?: { searchText?: unknown };
}

interface IngestPipeline {
  processors?: { text_embedding?: TextEmbeddingProcessor }[];
}

export class CandidateOpenSearchSetupRepository implements CandidateOpenSearchResources {
  public constructor(
    private readonly client: Client,
    private readonly config: OpenSearchSetupConfig,
    private readonly requests: CandidateOpenSearchSetupRequestMapper,
    private readonly searchPipeline: Record<string, unknown>,
  ) {}

  public async readCompatibleIndex(): Promise<CandidateIndexState> {
    const index = this.config.OPENSEARCH_INDEX;
    const response = await this.client.indices.exists({ index });
    const exists = response.body;
    if (!exists) {
      return { exists, embeddingModelId: undefined };
    }
    const mappings = await this.client.indices.getMapping({ index });
    const mapping = mappings.body[index]?.mappings;
    this.requireCompatibleMapping(mapping);
    return { exists, embeddingModelId: mapping?._meta?.embedding_model_id };
  }

  public async verifyIngestPipeline(modelId: string): Promise<void> {
    try {
      const response = await this.client.transport.request({
        method: "GET",
        path: "/_ingest/pipeline/" + this.config.OPENSEARCH_INGEST_PIPELINE,
      });
      const pipeline: IngestPipeline | undefined = response.body[this.config.OPENSEARCH_INGEST_PIPELINE];
      this.requireCompatiblePipeline(pipeline, modelId);
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) {
        throw error;
      }
    }
  }

  public async verifyRemoteEmbedding(modelId: string): Promise<void> {
    const request = this.requests.createSimulationRequest(modelId);
    const response = await this.client.transport.request(request);
    simulationSchema.parse(response.body);
  }

  public async installIngestPipeline(modelId: string): Promise<void> {
    const request = this.requests.createIngestPipelineRequest(modelId);
    await this.client.transport.request(request);
  }

  public async installSearchPipeline(): Promise<void> {
    const request = this.requests.createSearchPipelineRequest(this.searchPipeline);
    await this.client.transport.request(request);
  }

  public async createIndex(modelId: string): Promise<void> {
    const request = this.requests.createIndexRequest(modelId);
    await this.client.indices.create(request);
  }

  public async updateIndexSettings(): Promise<void> {
    const request = this.requests.createIndexSettingsRequest();
    await this.client.indices.putSettings(request);
  }

  private requireCompatibleMapping(mapping: unknown): void {
    const compatibility = compatibleMappingSchema.safeParse(mapping);
    if (!compatibility.success) {
      throw new Error("Incompatible candidate index. Choose a new OPENSEARCH_INDEX and reindex candidates.", { cause: compatibility.error });
    }
  }

  private requireCompatiblePipeline(pipeline: IngestPipeline | undefined, modelId: string): void {
    const processor = this.findEmbeddingProcessor(pipeline);
    if (processor?.model_id !== modelId || processor?.field_map?.searchText !== "embedding") {
      throw new Error("The ingest pipeline has different embedding settings. Choose a new OPENSEARCH_INGEST_PIPELINE.");
    }
  }

  private findEmbeddingProcessor(pipeline: IngestPipeline | undefined): TextEmbeddingProcessor | undefined {
    if (!pipeline?.processors) {
      return undefined;
    }
    for (const processor of pipeline.processors) {
      if (processor.text_embedding) {
        return processor.text_embedding;
      }
    }
    return undefined;
  }
}
