import { API } from "@opensearch-project/opensearch";
import { OpenSearchConfig } from "../../../infrastructure/config/opensearchConfig";
import { CANDIDATE_VECTOR_FIELDS } from "../../../infrastructure/opensearch/titanEmbeddingConfig";
import { CandidateVectorTarget } from "../../application/models/candidateSearchAspect";
import { CandidateIndependentSearchRequestMapping } from "../ports/candidateIndependentSearchRequestMapping";

const VECTOR_FIELDS = Object.values(CANDIDATE_VECTOR_FIELDS).map((field) => field.vector);
import { CandidateLexicalQueryMapping } from "../ports/candidateLexicalQueryMapping";
import { CandidateVectorQueryMapping } from "../ports/candidateVectorQueryMapping";

export class CandidateIndependentSearchRequestMapper implements CandidateIndependentSearchRequestMapping {
  public constructor(
    private readonly config: Pick<OpenSearchConfig, "OPENSEARCH_INDEX">,
    private readonly lexicalQuery: CandidateLexicalQueryMapping,
    private readonly vectorQuery: CandidateVectorQueryMapping
  ) { }

  public mapLexical(query: string, poolSize: number): API.Search_Request {
    return this.createRequest(this.lexicalQuery.map(query), poolSize);
  }

  public mapVector(target: CandidateVectorTarget, query: string, poolSize: number): API.Search_Request {
    return this.createRequest(this.vectorQuery.map(target, query, poolSize), poolSize);
  }

  private createRequest(query: NonNullable<API.Search_RequestBody["query"]>, poolSize: number): API.Search_Request {
    return {
      index: this.config.OPENSEARCH_INDEX,
      // Explicitly bypass any default index search pipeline as well as the old hybrid pipeline.
      search_pipeline: "_none",
      allow_partial_search_results: false,
      body: {
        size: poolSize,
        _source: { excludes: [...VECTOR_FIELDS] },
        query,
      },
    };
  }
}
