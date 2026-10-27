import { Candidate } from "../../domain/entities/candidate";

export interface CandidateBatchEditor {
  withLock<T>(operation: () => Promise<T>): Promise<T>;
  read(file: string): Promise<Candidate[]>;
  save(file: string, candidates: Candidate[]): Promise<void>;
}
