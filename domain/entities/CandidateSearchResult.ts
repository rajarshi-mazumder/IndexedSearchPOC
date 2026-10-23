import { CandidateDocument } from "./CandidateDocument";

export interface CandidateSearchResult {
  score: number;
  document: CandidateDocument;
}
