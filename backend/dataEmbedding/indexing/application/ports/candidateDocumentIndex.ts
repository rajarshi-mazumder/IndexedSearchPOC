import { CandidateDocument } from "../../../../candidateData/models/candidateDocument";

export interface CandidateDocumentIndex {
  indexMany(documents: CandidateDocument[]): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
}
