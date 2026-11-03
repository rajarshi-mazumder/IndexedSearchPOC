import { CandidateSearchAspect } from "./candidateSearchAspect";

/** Free text for keyword and overall vector search, plus optional text per aspect vector. */
export type CandidateSearchQuery = { query: string } & Partial<Record<CandidateSearchAspect, string>>;
