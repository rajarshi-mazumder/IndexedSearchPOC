import { z } from "zod";
import { CandidateSearchResult } from "../../domain/entities/candidate-search-result";
import { CandidateSearch } from "../ports/candidate-search";

const requestSchema = z.object({
  query: z.string().trim().min(1).max(10000),
  limit: z.number().int().min(1).max(100),
});

export class SearchCandidates {
  constructor(private readonly candidateSearch: CandidateSearch) {}

  async execute(query: string, limit = 20): Promise<CandidateSearchResult[]> {
    const request = requestSchema.parse({ query, limit });
    return this.candidateSearch.search(request.query, request.limit);
  }
}
