import { CandidateSearchResult } from "../models/candidateSearchResult";

export interface CandidateSearchRepository {
  search(query: string, limit: number): Promise<CandidateSearchResult[]>;
}
