import { z } from "zod";
import { CandidateSearchResult } from "../models/candidateSearchResult";
import { CandidateSearchQuery } from "../models/candidateSearchQuery";
import { CandidateSearchBranchHits } from "../models/candidateSearchBranchHits";
import { CANDIDATE_SEARCH_ASPECTS, CandidateVectorTarget } from "../models/candidateSearchAspect";
import { CandidateSearchRepository } from "../ports/candidateSearchRepository";
import { CandidateSearchRanking } from "../ports/candidateSearchRanking";

/** Blank aspect text means "not requested", so that vector is not searched. */
const aspectText = z.string().trim().max(10000).optional().transform((value) => value || undefined);
const requestSchema = z.object({
  query: z.string().trim().min(1).max(10000),
  skills: aspectText,
  languages: aspectText,
  region: aspectText,
  limit: z.number().int().min(1).max(100),
});

export class SearchCandidatesUseCase {
  public constructor(
    private readonly candidateSearch: CandidateSearchRepository,
    private readonly ranking: CandidateSearchRanking
  ) { }

  public async execute(search: CandidateSearchQuery, limit = 20): Promise<CandidateSearchResult[]> {
    const request = this.validateRequest(search, limit);
    const poolSize = this.calculateRetrievalPoolSize(request.limit);
    const branches: Promise<CandidateSearchBranchHits>[] = [
      this.searchLexical(request.query, poolSize),
      this.searchVector("overall", request.query, poolSize),
    ];
    for (const aspect of CANDIDATE_SEARCH_ASPECTS) {
      const text = request[aspect];
      if (text) {
        branches.push(this.searchVector(aspect, text, poolSize));
      }
    }
    return this.ranking.rank(await Promise.all(branches), request.limit);
  }

  private async searchLexical(query: string, poolSize: number): Promise<CandidateSearchBranchHits> {
    return { branch: "lexical", hits: await this.candidateSearch.searchLexical(query, poolSize) };
  }

  private async searchVector(target: CandidateVectorTarget, text: string, poolSize: number): Promise<CandidateSearchBranchHits> {
    return { branch: target, hits: await this.candidateSearch.searchVector(target, text, poolSize) };
  }

  private calculateRetrievalPoolSize(limit: number): number {
    return Math.max(limit * 3, 50);
  }

  private validateRequest(search: CandidateSearchQuery, limit: number): z.infer<typeof requestSchema> {
    return requestSchema.parse({ ...search, limit });
  }
}
