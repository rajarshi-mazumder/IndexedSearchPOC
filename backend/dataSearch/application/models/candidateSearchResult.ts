import { CandidateDocument } from "../../../candidateData/models/candidateDocument";

export interface CandidateSearchResult {
  score: number;
  rankingMethod: "rrf";
  lexicalScore: number | null;
  vectorScore: number | null;
  lexicalRank: number | null;
  vectorRank: number | null;
  document: CandidateDocument;
}
