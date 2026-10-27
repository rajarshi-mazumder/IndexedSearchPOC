import { Candidate } from "../../domain/entities/candidate";

export interface CandidateBatchCheckpoint {
  version: 1;
  org: string;
  sourceId: string;
  batchSize: number;
  batchNumber: number;
  fetched: number;
  lastId?: string;
  complete: boolean;
}

export interface CandidateBatchExportStore {
  withLock<T>(operation: () => Promise<T>): Promise<T>;
  loadCheckpoint(): Promise<CandidateBatchCheckpoint | undefined>;
  saveCheckpoint(checkpoint: CandidateBatchCheckpoint): Promise<void>;
  saveBatch(batchNumber: number, candidates: Candidate[]): Promise<string>;
}
