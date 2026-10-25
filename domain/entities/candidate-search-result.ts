import { CandidateDocument } from "./candidate-document";

export interface CandidateSearchResult {
  score: number;
  document: CandidateDocument;
}
