import { Client } from "@opensearch-project/opensearch";
import { CandidateSearch } from "../../application/ports/candidate-search";
import { CandidateSearchResult } from "../../domain/entities/candidate-search-result";
import { OpenSearchConfig } from "../config/opensearch-config";
import { OpenSearchCandidateDocumentMapper } from "./open-search-candidate-document-mapper";

export class OpenSearchHybridSearch implements CandidateSearch {
  constructor(private readonly client: Client, private readonly config: OpenSearchConfig) {}

  async search(query: string, limit: number): Promise<CandidateSearchResult[]> {
    const response = await this.client.search({
      index: this.config.OPENSEARCH_INDEX,
      search_pipeline: this.config.OPENSEARCH_SEARCH_PIPELINE,
      allow_partial_search_results: false,
      body: {
        size: limit,
        _source: { excludes: ["embedding"] },
        query: {
          hybrid: {
            queries: [
              {
                multi_match: {
                  query,
                  // Candidate evidence spans fields; long natural-language queries
                  // should not require most words to occur in one field.
                  type: "cross_fields",
                  fields: ["skills^10", "title^8", "jobFunctions^6", "systems^5", "skillCategories^4", "profile"],
                  minimum_should_match: "2<30%",
                },
              },
              {
                neural: {
                  embedding: {
                    query_text: query,
                    model_id: this.config.OPENSEARCH_MODEL_ID,
                    k: Math.max(limit * 3, 50),
                  },
                },
              },
            ],
          },
        },
      },
    });
    if (response.body.timed_out || (response.body._shards?.failed ?? 0) > 0) {
      throw new Error("OpenSearch did not complete the hybrid search; refusing partial results.");
    }
    return response.body.hits.hits.map((hit) => ({
      score: hit._score ?? 0,
      document: OpenSearchCandidateDocumentMapper.fromDocument(hit._source),
    }));
  }
}
