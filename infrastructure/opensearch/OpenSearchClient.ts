import { Client } from "@opensearch-project/opensearch";
import { opensearchConfig } from "../config/opensearch";

export class OpenSearchClient {
  private readonly client: Client;

  constructor() {
    this.client = new Client({
      node: opensearchConfig.OPENSEARCH_NODE,
      auth: {
        username: opensearchConfig.OPENSEARCH_USERNAME,
        password: opensearchConfig.OPENSEARCH_PASSWORD,
      },
    });
  }

  get connection() {
    return this.client;
  }
}
