import { CandidateDocument } from "../../../candidateData/models/candidateDocument";

/** A hit in one OpenSearch result list, before backend ranking. */
export interface CandidateSearchHit {
  score: number | null;
  document: CandidateDocument;
}
