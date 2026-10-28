import { Client } from "@opensearch-project/opensearch";
import { OpenSearchConfig } from "../../backend/infrastructure/config/opensearchConfig";
import { CandidateSearchRepository } from "../../backend/dataSearch/application/ports/candidateSearchRepository";
import { CandidateSearchResult } from "../../backend/dataSearch/application/models/candidateSearchResult";
import { createCandidateSearchRepository } from "../../backend/composition/createCandidateSearch";

/** Adapts construction only; all requests and result handling use production code. */
export class SearchOpenSearchCandidatesTestDriver implements CandidateSearchRepository {
  private readonly repository: CandidateSearchRepository;

  public constructor(client: Client, config: OpenSearchConfig) {
    this.repository = createCandidateSearchRepository(client, config);
  }

  public search(query: string, limit: number): Promise<CandidateSearchResult[]> {
    return this.repository.search(query, limit);
  }
}
