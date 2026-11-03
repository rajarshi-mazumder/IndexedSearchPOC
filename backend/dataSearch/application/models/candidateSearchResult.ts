import { CandidateDocument } from "../../../candidateData/models/candidateDocument";
import { CandidateSearchAspect } from "./candidateSearchAspect";

export interface CandidateSearchResult {
  score: number;
  rankingMethod: "rrf";
  lexicalScore: number | null;
  vectorScore: number | null;
  lexicalRank: number | null;
  vectorRank: number | null;
  /** Position in each aspect vector list that was searched and contained this candidate. */
  aspectRanks: Partial<Record<CandidateSearchAspect, number>>;
  document: CandidateDocument;
}
