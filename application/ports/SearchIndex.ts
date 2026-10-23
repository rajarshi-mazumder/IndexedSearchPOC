import { CandidateDocument } from "../../domain/entities/CandidateDocument";

export interface SearchIndex {
  createIndex(): Promise<void>;
  bulkIndex(documents: CandidateDocument[]): Promise<void>;
  delete(ids: string[]): Promise<void>;
  search(query: string): Promise<string[]>;
}
