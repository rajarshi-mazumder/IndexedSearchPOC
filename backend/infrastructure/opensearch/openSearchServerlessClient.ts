import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import { AwsCredentialIdentityProvider } from "@aws-sdk/types";
import { OpenSearchConnectionConfig } from "../config/opensearchConfig";

export class OpenSearchServerlessClient {
  readonly connection: Client;

  constructor(config: OpenSearchConnectionConfig, credentials: AwsCredentialIdentityProvider) {
    this.connection = new Client({
      ...AwsSigv4Signer({ region: config.AWS_REGION, service: "aoss", getCredentials: credentials }),
      node: config.OPENSEARCH_NODE,
      requestTimeout: 120000,
      maxRetries: 2,
    });
  }
}
