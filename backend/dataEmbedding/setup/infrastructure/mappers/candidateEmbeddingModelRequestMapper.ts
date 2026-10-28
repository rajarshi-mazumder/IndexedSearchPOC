import { OpenSearchSetupConfig } from "../../../../infrastructure/config/opensearchConfig";
import { TITAN_DIMENSIONS, TITAN_MODEL_ID } from "../../../../infrastructure/opensearch/titanEmbeddingConfig";

export class CandidateEmbeddingModelRequestMapper {
  public constructor(private readonly config: OpenSearchSetupConfig) {}

  public createConnectorRequest(name: string) {
    return {
      method: "POST",
      path: "/_plugins/_ml/connectors/_create",
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
        actions: [this.createPredictionAction()],
      },
    };
  }

  public createModelRegistrationRequest(name: string, connectorId: string) {
    return {
      method: "POST",
      path: "/_plugins/_ml/models/_register",
      body: {
        name,
        function_name: "remote",
        connector_id: connectorId,
        description: "Candidate embeddings: Titan V2, 1024 dimensions, normalized",
      },
    };
  }

  private createPredictionAction() {
    return {
      action_type: "predict",
      method: "POST",
      url: "https://bedrock-runtime.${parameters.region}.amazonaws.com/model/${parameters.model}/invoke",
      headers: { "content-type": "application/json", "x-amz-content-sha256": "required" },
      request_body: '{ "inputText": "${parameters.inputText}", "dimensions": ${parameters.dimensions}, "normalize": ${parameters.normalize} }',
      pre_process_function: "connector.pre_process.bedrock.embedding",
      post_process_function: "connector.post_process.bedrock.embedding",
    };
  }
}
