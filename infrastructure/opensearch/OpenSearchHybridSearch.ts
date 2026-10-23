import { CandidateSearchResult } from "../../domain/entities/CandidateSearchResult";
import { OpenSearchClient } from "./OpenSearchClient";
import { OpenSearchDocumentMapper } from "./OpenSearchDocumentMapper";
import { opensearchConfig } from "../config/opensearch";

export class OpenSearchHybridSearch {
  constructor(private readonly client = new OpenSearchClient()) {}

  async search(query: string, embedding: number[], limit = 20): Promise<CandidateSearchResult[]> {
    if (embedding.length !== 768) {
      throw new Error(`Expected a 768-dimensional query embedding, received ${embedding.length}`);
    }
    const response = await this.client.connection.search({
      index: opensearchConfig.OPENSEARCH_INDEX,
      search_pipeline: opensearchConfig.OPENSEARCH_SEARCH_PIPELINE,
      body: {
        size: limit,
        query: {
          hybrid: {
            queries: [
              {
                multi_match: {
                  query,
                  type: "best_fields",
                  fields: [
                    "skills^10",
                    "title^8",
                    "jobFunctions^6",
                    "systems^5",
                    "skillCategories^4",
                    "profile",
                  ],
                  minimum_should_match: "2<75%",
                },
              },
              {
                knn: {
                  embedding: {
                    vector: Array.from(embedding),
                    k: Math.max(limit * 3, 50),
                  },
                },
              },
            ],
          },
        },
      } as any,
    });

    const hits = (response.body as any).hits.hits;
    return hits.map((hit: any) => ({
      score: hit._score,
      document: OpenSearchDocumentMapper.fromDocument(hit._source),
    }));
  }
}
