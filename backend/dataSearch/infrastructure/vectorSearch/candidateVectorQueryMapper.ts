import { API } from "@opensearch-project/opensearch";
import { OpenSearchConfig } from "../../../infrastructure/config/opensearchConfig";
import { CandidateVectorQueryMapping } from "../ports/candidateVectorQueryMapping";

export class CandidateVectorQueryMapper implements CandidateVectorQueryMapping {
  public constructor(private readonly config: Pick<OpenSearchConfig, "OPENSEARCH_MODEL_ID">) { }

  public map(query: string, limit: number): NonNullable<API.Search_RequestBody["query"]> {
    return {
      neural: {
        embedding: {
          query_text: query,
          model_id: this.config.OPENSEARCH_MODEL_ID,
          k: this.calculateNeighborCount(limit),
        },
      },
    };
  }

  private calculateNeighborCount(limit: number): number {
    return Math.max(limit * 3, 50);
  }
}
