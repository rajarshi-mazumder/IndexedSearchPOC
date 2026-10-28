import { Candidate } from "../../../shared/domain/models/candidate";

export interface CandidateBatchEditor {
  withLock<T>(operation: () => Promise<T>): Promise<T>;
  read(file: string): Promise<Candidate[]>;
  save(file: string, candidates: Candidate[]): Promise<void>;
}
