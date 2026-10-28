import { Client } from "@opensearch-project/opensearch";
import { z } from "zod";
import { OpenSearchSetupConfig } from "../../../../infrastructure/config/opensearchConfig";
import { TITAN_DIMENSIONS, TITAN_MODEL_ID } from "../../../../infrastructure/opensearch/titanEmbeddingConfig";
import { CandidateEmbeddingModel } from "../../application/ports/candidateEmbeddingModel";
import { CandidateEmbeddingModelRequestMapper } from "../mappers/candidateEmbeddingModelRequestMapper";

const searchResponse = z.object({
  hits: z.object({ hits: z.array(z.object({
    _id: z.string(), _source: z.object({ name: z.string() }),
  })) }),
});

export class CandidateEmbeddingModelRepository implements CandidateEmbeddingModel {
  public constructor(
    private readonly client: Client,
    private readonly config: OpenSearchSetupConfig,
    private readonly requests: CandidateEmbeddingModelRequestMapper,
  ) {}

  public async ensure(): Promise<string> {
    const name = this.config.OPENSEARCH_INDEX + "-titan-v2-1024";
    const modelId = await this.findConfiguredOrNamedModel(name);
    if (modelId) {
      await this.validateModelConnector(modelId);
      return modelId;
    }
    const connectorId = await this.findOrCreateConnector(name);
    return this.registerRemoteModel(name, connectorId);
  }

  private async findConfiguredOrNamedModel(name: string): Promise<string | undefined> {
    if (this.config.OPENSEARCH_MODEL_ID != null) {
      return this.config.OPENSEARCH_MODEL_ID;
    }
    return this.findByName("models", name);
  }

  private async validateModelConnector(modelId: string): Promise<void> {
    const response = await this.client.transport.request({
      method: "GET",
      path: "/_plugins/_ml/models/" + encodeURIComponent(modelId),
    });
    const model = z.object({ connector_id: z.string() }).parse(response.body);
    await this.validateConnector(model.connector_id);
  }

  private async findOrCreateConnector(name: string): Promise<string> {
    const connectorId = await this.findByName("connectors", name);
    if (connectorId) {
      await this.validateConnector(connectorId);
      return connectorId;
    }
    const request = this.requests.createConnectorRequest(name);
    const response = await this.client.transport.request(request);
    return z.object({ connector_id: z.string() }).parse(response.body).connector_id;
  }

  private async registerRemoteModel(name: string, connectorId: string): Promise<string> {
    const request = this.requests.createModelRegistrationRequest(name, connectorId);
    const response = await this.client.transport.request(request);
    // Preserve the existing Serverless flow without a separate deploy request.
    return z.object({ model_id: z.string() }).parse(response.body).model_id;
  }

  private async findByName(resource: "models" | "connectors", name: string): Promise<string | undefined> {
    const response = await this.client.transport.request({
      method: "POST",
      path: "/_plugins/_ml/" + resource + "/_search",
      body: { size: 100, query: { match_phrase: { name } } },
    });
    const hits = searchResponse.parse(response.body).hits.hits;
    const matches: typeof hits = [];
    for (const hit of hits) {
      if (hit._source.name === name) {
        matches.push(hit);
      }
    }
    if (matches.length > 1) {
      throw new Error("Multiple " + resource + " named " + name + "; resolve duplicate setup resources first.");
    }
    return matches[0]?._id;
  }

  private async validateConnector(id: string): Promise<void> {
    const response = await this.client.transport.request({
      method: "GET",
      path: "/_plugins/_ml/connectors/" + encodeURIComponent(id),
    });
    z.object({
      protocol: z.literal("aws_sigv4"),
      parameters: z.object({
        region: z.literal(this.config.AWS_REGION),
        service_name: z.literal("bedrock"),
        model: z.literal(TITAN_MODEL_ID),
        dimensions: z.coerce.number().pipe(z.literal(TITAN_DIMENSIONS)),
        normalize: z.union([z.literal(true), z.literal("true")]),
      }),
    }).parse(response.body);
  }
}
