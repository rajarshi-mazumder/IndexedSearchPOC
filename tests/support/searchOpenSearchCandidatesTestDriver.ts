import { Client } from "@opensearch-project/opensearch";
import { OpenSearchConfig } from "../../backend/infrastructure/config/opensearchConfig";
import { SearchCandidatesUseCase } from "../../backend/dataSearch/application/useCases/searchCandidatesUseCase";
import { CandidateSearchResult } from "../../backend/dataSearch/application/models/candidateSearchResult";
import { createCandidateSearchUseCase } from "../../backend/composition/createCandidateSearch";

/** Adapts construction only; all requests and result handling use production code. */
export class SearchOpenSearchCandidatesTestDriver {
  private readonly useCase: SearchCandidatesUseCase;

  public constructor(client: Client, config: OpenSearchConfig) {
    this.useCase = createCandidateSearchUseCase(client, config);
  }

  public search(query: string, limit: number): Promise<CandidateSearchResult[]> {
    return this.useCase.execute(query, limit);
  }
}
