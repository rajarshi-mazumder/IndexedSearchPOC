import { API } from "@opensearch-project/opensearch";
import { OpenSearchConfig } from "../../../infrastructure/config/opensearchConfig";
import { CANDIDATE_VECTOR_FIELDS } from "../../../infrastructure/opensearch/titanEmbeddingConfig";
import { CandidateVectorTarget } from "../../application/models/candidateSearchAspect";
import { CandidateVectorQueryMapping } from "../ports/candidateVectorQueryMapping";

export class CandidateVectorQueryMapper implements CandidateVectorQueryMapping {
  public constructor(private readonly config: Pick<OpenSearchConfig, "OPENSEARCH_MODEL_ID">) { }

  public map(target: CandidateVectorTarget, query: string, poolSize: number): NonNullable<API.Search_RequestBody["query"]> {
    return this.createNeuralQuery(CANDIDATE_VECTOR_FIELDS[target].vector, query, poolSize);
  }

  private createNeuralQuery(vectorField: string, query: string, poolSize: number): NonNullable<API.Search_RequestBody["query"]> {
    return {
      neural: {
        [vectorField]: {
          query_text: query,
          model_id: this.config.OPENSEARCH_MODEL_ID,
          k: poolSize,
        },
      },
    };
  }
}
