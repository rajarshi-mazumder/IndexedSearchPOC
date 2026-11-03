import { CandidateSearchHit } from "./candidateSearchHit";
import { CandidateVectorTarget } from "./candidateSearchAspect";

export type CandidateSearchBranch = "lexical" | CandidateVectorTarget;

/** One independently ranked result list, before fusion. */
export interface CandidateSearchBranchHits {
  branch: CandidateSearchBranch;
  hits: CandidateSearchHit[];
}
