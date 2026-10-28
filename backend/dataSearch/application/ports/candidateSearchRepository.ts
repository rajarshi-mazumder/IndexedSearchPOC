import { CandidateSearchHit } from "../models/candidateSearchHit";

export interface CandidateSearchRepository {
  searchLexical(query: string, poolSize: number): Promise<CandidateSearchHit[]>;
  searchVector(query: string, poolSize: number): Promise<CandidateSearchHit[]>;
}
