import { CandidateSearchBranchHits } from "../models/candidateSearchBranchHits";
import { CandidateSearchResult } from "../models/candidateSearchResult";

export interface CandidateSearchRanking {
  rank(branches: CandidateSearchBranchHits[], limit: number): CandidateSearchResult[];
}
