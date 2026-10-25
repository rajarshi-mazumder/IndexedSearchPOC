import { CandidateDocument } from "../../domain/entities/candidate-document";

export interface CandidateDocumentIndex {
  indexMany(documents: CandidateDocument[]): Promise<void>;
}
