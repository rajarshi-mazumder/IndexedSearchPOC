/** Parts of a candidate with their own vector, searched only when the request gives text for them. */
export const CANDIDATE_SEARCH_ASPECTS = ["skills", "languages", "region"] as const;

export type CandidateSearchAspect = typeof CANDIDATE_SEARCH_ASPECTS[number];

/** The whole-candidate vector or one aspect vector. */
export type CandidateVectorTarget = "overall" | CandidateSearchAspect;
