import { API, Client } from "@opensearch-project/opensearch";
import { CandidateSearchRepository } from "../../application/ports/candidateSearchRepository";
import { CandidateSearchResult } from "../../application/models/candidateSearchResult";
import { CandidateHybridSearchRequestMapping } from "../ports/candidateHybridSearchRequestMapping";
import { CandidateSearchResponseMapping } from "../ports/candidateSearchResponseMapping";

export class CandidateOpenSearchSearchRepository implements CandidateSearchRepository {
  public constructor(
    private readonly client: Pick<Client, "search">,
    private readonly requests: CandidateHybridSearchRequestMapping,
    private readonly responses: CandidateSearchResponseMapping
  ) { }

  public async search(query: string, limit: number): Promise<CandidateSearchResult[]> {
    const request = this.requests.map(query, limit);
    const response = await this.executeSearchRequest(request);
    return this.responses.map(response);
  }

  private async executeSearchRequest(request: API.Search_Request): Promise<API.Search_ResponseBody> {
    const response = await this.client.search(request);
    return response.body;
  }
}
