import { Candidate } from "../../../../../shared/domain/models/candidate";
import { CandidateDocument } from "../../../../candidateData/models/candidateDocument";

export type PreparedCandidateDocument = Omit<CandidateDocument, "indexedAt">;

export interface CandidateDocumentPreparation {
  prepare(candidate: Candidate): PreparedCandidateDocument | null;
}
