import { CandidateDocument } from "../../domain/entities/CandidateDocument";

export interface DocumentIndex {
  initialize(): Promise<void>;
  index(document: CandidateDocument): Promise<void>;
  indexMany(documents: CandidateDocument[]): Promise<void>;
  findById(id: string): Promise<CandidateDocument | null>;
}
