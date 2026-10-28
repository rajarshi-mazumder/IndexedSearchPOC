import { z } from "zod";
import { CandidateSearchResult } from "../models/candidateSearchResult";
import { CandidateSearchRepository } from "../ports/candidateSearchRepository";

const requestSchema = z.object({
  query: z.string().trim().min(1).max(10000),
  limit: z.number().int().min(1).max(100),
});

export class SearchCandidatesUseCase {
  public constructor(private readonly candidateSearch: CandidateSearchRepository) { }

  public async execute(query: string, limit = 20): Promise<CandidateSearchResult[]> {
    const request = this.validateRequest(query, limit);
    return this.candidateSearch.search(request.query, request.limit);
  }

  private validateRequest(query: string, limit: number): z.infer<typeof requestSchema> {
    return requestSchema.parse({ query, limit });
  }
}
