import { CandidateBatchCheckpoint } from "./candidate-batch-export-store";
import { CandidateBatchExportProgress } from "./candidate-batch-export-progress";
import { CandidateSearchResult } from "../../domain/entities/candidate-search-result";
import { OperationRequest } from "../../shared/candidate-console-contracts";

/** Executes existing application operations with a fixed, captured configuration. */
export interface CandidateConsoleOperations {
  fetch(request: Extract<OperationRequest, { kind: "fetch" }>, report: (progress: CandidateBatchExportProgress) => void, signal: AbortSignal): Promise<CandidateBatchCheckpoint>;
  setup(): Promise<string>;
  search(query: string, limit: number): Promise<CandidateSearchResult[]>;
  index(file: string, report: (progress: { processed: number; total: number; indexed: number; skipped: number }) => void, signal: AbortSignal): Promise<{ indexed: number; skipped: number }>;
}
