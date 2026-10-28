import { z } from "zod";
import { CandidateSearchResult } from "../models/candidateSearchResult";
import { CandidateSearchRepository } from "../ports/candidateSearchRepository";
import { CandidateSearchRanking } from "../ports/candidateSearchRanking";

const requestSchema = z.object({
  query: z.string().trim().min(1).max(10000),
  limit: z.number().int().min(1).max(100),
});

export class SearchCandidatesUseCase {
  public constructor(
    private readonly candidateSearch: CandidateSearchRepository,
    private readonly ranking: CandidateSearchRanking
  ) { }

  public async execute(query: string, limit = 20): Promise<CandidateSearchResult[]> {
    const request = this.validateRequest(query, limit);
    const poolSize = this.calculateRetrievalPoolSize(request.limit);
    const [lexicalHits, vectorHits] = await Promise.all([
      this.candidateSearch.searchLexical(request.query, poolSize),
      this.candidateSearch.searchVector(request.query, poolSize),
    ]);
    return this.ranking.rank(lexicalHits, vectorHits, request.limit);
  }

  private calculateRetrievalPoolSize(limit: number): number {
    return Math.max(limit * 3, 50);
  }

  private validateRequest(query: string, limit: number): z.infer<typeof requestSchema> {
    return requestSchema.parse({ query, limit });
  }
}
