import { API, Client } from "@opensearch-project/opensearch";
import { CandidateSearchRepository } from "../../application/ports/candidateSearchRepository";
import { CandidateSearchHit } from "../../application/models/candidateSearchHit";
import { CandidateIndependentSearchRequestMapping } from "../ports/candidateIndependentSearchRequestMapping";
import { CandidateSearchResponseMapping } from "../ports/candidateSearchResponseMapping";

export class CandidateOpenSearchSearchRepository implements CandidateSearchRepository {
  public constructor(
    private readonly client: Pick<Client, "search">,
    private readonly requests: CandidateIndependentSearchRequestMapping,
    private readonly responses: CandidateSearchResponseMapping
  ) { }

  public async searchLexical(query: string, poolSize: number): Promise<CandidateSearchHit[]> {
    const request = this.requests.mapLexical(query, poolSize);
    const response = await this.executeSearchRequest(request);
    return this.responses.map(response);
  }

  public async searchVector(query: string, poolSize: number): Promise<CandidateSearchHit[]> {
    const request = this.requests.mapVector(query, poolSize);
    const response = await this.executeSearchRequest(request);
    return this.responses.map(response);
  }

  private async executeSearchRequest(request: API.Search_Request): Promise<API.Search_ResponseBody> {
    const response = await this.client.search(request);
    return response.body;
  }
}
