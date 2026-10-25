import { CandidateSearchResult } from "../../domain/entities/candidate-search-result";

export interface CandidateSearch {
  search(query: string, limit: number): Promise<CandidateSearchResult[]>;
}
