import { API } from "@opensearch-project/opensearch";
import { OpenSearchConfig } from "../../../infrastructure/config/opensearchConfig";
import { CandidateHybridSearchRequestMapping } from "../ports/candidateHybridSearchRequestMapping";
import { CandidateLexicalQueryMapping } from "../ports/candidateLexicalQueryMapping";
import { CandidateVectorQueryMapping } from "../ports/candidateVectorQueryMapping";

export class CandidateHybridSearchRequestMapper implements CandidateHybridSearchRequestMapping {
  public constructor(
    private readonly config: Pick<OpenSearchConfig, "OPENSEARCH_INDEX" | "OPENSEARCH_SEARCH_PIPELINE">,
    private readonly lexicalQuery: CandidateLexicalQueryMapping,
    private readonly vectorQuery: CandidateVectorQueryMapping
  ) { }

  public map(query: string, limit: number): API.Search_Request {
    return {
      index: this.config.OPENSEARCH_INDEX,
      search_pipeline: this.config.OPENSEARCH_SEARCH_PIPELINE,
      allow_partial_search_results: false,
      body: {
        size: limit,
        _source: { excludes: ["embedding"] },
        query: this.createHybridQuery(query, limit),
      },
    };
  }

  private createHybridQuery(query: string, limit: number): NonNullable<API.Search_RequestBody["query"]> {
    return {
      hybrid: {
        // Pipeline weights correspond to this order: lexical first, vector second.
        queries: [
          this.lexicalQuery.map(query),
          this.vectorQuery.map(query, limit),
        ],
      },
    };
  }
}
