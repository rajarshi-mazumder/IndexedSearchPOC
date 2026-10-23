import { CandidateSearchResult } from "../../domain/entities/CandidateSearchResult";
import { EmbeddingProvider } from "../ports/EmbeddingProvider";
import { OpenSearchHybridSearch } from "../../infrastructure/opensearch/OpenSearchHybridSearch";

export class SearchCandidates {
  constructor(
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly hybridSearch: OpenSearchHybridSearch,
  ) {}

  async execute(query: string, limit = 20): Promise<CandidateSearchResult[]> {
    const queryEmbedding = await this.embeddingProvider.embedQuery(query);
    return this.hybridSearch.search(query, queryEmbedding, limit);
  }
}
