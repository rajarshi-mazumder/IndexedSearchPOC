import { CandidateSearchHit } from "../models/candidateSearchHit";
import { CandidateSearchResult } from "../models/candidateSearchResult";

export interface CandidateSearchRanking {
  rank(lexicalHits: CandidateSearchHit[], vectorHits: CandidateSearchHit[], limit: number): CandidateSearchResult[];
}
