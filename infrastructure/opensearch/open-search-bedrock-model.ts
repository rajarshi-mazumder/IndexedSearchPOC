import { Client } from "@opensearch-project/opensearch";
import { z } from "zod";
import { OpenSearchSetupConfig } from "../config/opensearch-config";
import { TITAN_DIMENSIONS, TITAN_MODEL_ID } from "./titan-embedding-config";

const searchResponse = z.object({
  hits: z.object({ hits: z.array(z.object({
    _id: z.string(), _source: z.object({ name: z.string() }),
  })) }),
});

export class OpenSearchBedrockModel {
  constructor(private readonly client: Client, private readonly config: OpenSearchSetupConfig) {}

  async ensure(): Promise<string> {
    const name = this.config.OPENSEARCH_INDEX + "-titan-v2-1024";
    const modelId = this.config.OPENSEARCH_MODEL_ID ?? await this.findByName("models", name);
    if (modelId) {
      const model = await this.client.transport.request({
        method: "GET", path: "/_plugins/_ml/models/" + encodeURIComponent(modelId),
      });
      const { connector_id } = z.object({ connector_id: z.string() }).parse(model.body);
      await this.validateConnector(connector_id);
      return modelId;
    }

    let connectorId = await this.findByName("connectors", name);
    if (connectorId) {
      await this.validateConnector(connectorId);
    } else {
      const response = await this.client.transport.request({
        method: "POST", path: "/_plugins/_ml/connectors/_create",
        body: {
          name,
          description: "Titan V2 embeddings for candidate ingestion and neural queries",
          version: 1,
          protocol: "aws_sigv4",
          parameters: {
            region: this.config.AWS_REGION,
            service_name: "bedrock",
            model: TITAN_MODEL_ID,
            dimensions: TITAN_DIMENSIONS,
            normalize: true,
          },
          credential: { roleArn: this.config.BEDROCK_ROLE_ARN },
          actions: [{
            action_type: "predict", method: "POST",
            url: "https://bedrock-runtime.${parameters.region}.amazonaws.com/model/${parameters.model}/invoke",
            headers: { "content-type": "application/json", "x-amz-content-sha256": "required" },
            request_body: '{ "inputText": "${parameters.inputText}", "dimensions": ${parameters.dimensions}, "normalize": ${parameters.normalize} }',
            pre_process_function: "connector.pre_process.bedrock.embedding",
            post_process_function: "connector.post_process.bedrock.embedding",
          }],
        },
      });
      connectorId = z.object({ connector_id: z.string() }).parse(response.body).connector_id;
    }
    const registration = await this.client.transport.request({
      method: "POST", path: "/_plugins/_ml/models/_register",
      body: { name, function_name: "remote", connector_id: connectorId,
        description: "Candidate embeddings: Titan V2, 1024 dimensions, normalized" },
    });
    // Serverless uses remote models without a separate deploy call.
    return z.object({ model_id: z.string() }).parse(registration.body).model_id;
  }

  private async findByName(resource: "models" | "connectors", name: string): Promise<string | undefined> {
    const response = await this.client.transport.request({
      method: "POST", path: "/_plugins/_ml/" + resource + "/_search",
      body: { size: 100, query: { match_phrase: { name } } },
    });
    const matches = searchResponse.parse(response.body).hits.hits.filter((hit) => hit._source.name === name);
    if (matches.length > 1) throw new Error("Multiple " + resource + " named " + name + "; resolve duplicate setup resources first.");
    return matches[0]?._id;
  }

  private async validateConnector(id: string): Promise<void> {
    const response = await this.client.transport.request({
      method: "GET", path: "/_plugins/_ml/connectors/" + encodeURIComponent(id),
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
