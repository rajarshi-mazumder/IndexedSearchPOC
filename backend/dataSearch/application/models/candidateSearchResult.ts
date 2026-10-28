import { CandidateDocument } from "../../../candidateData/models/candidateDocument";

export interface CandidateSearchResult {
  score: number;
  document: CandidateDocument;
}
