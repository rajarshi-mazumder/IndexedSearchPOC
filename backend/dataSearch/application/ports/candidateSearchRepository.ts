import { CandidateSearchHit } from "../models/candidateSearchHit";
import { CandidateVectorTarget } from "../models/candidateSearchAspect";

export interface CandidateSearchRepository {
  searchLexical(query: string, poolSize: number): Promise<CandidateSearchHit[]>;
  searchVector(target: CandidateVectorTarget, text: string, poolSize: number): Promise<CandidateSearchHit[]>;
}
