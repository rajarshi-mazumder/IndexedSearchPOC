import { Candidate } from "../../../shared/domain/models/candidate";

export interface CandidateBatchCheckpoint {
  version: 1;
  extractionKey?: string;
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
