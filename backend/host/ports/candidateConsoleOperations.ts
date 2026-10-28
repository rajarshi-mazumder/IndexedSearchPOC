import { CandidateBatchCheckpoint } from "../../candidateData/ports/candidateBatchExportStore";
import { CandidateBatchExportProgress } from "../../candidateData/ports/candidateBatchExportProgress";
import { CandidateSearchResult } from "../../dataSearch/application/models/candidateSearchResult";
import { OperationRequest } from "../../../shared/candidateConsoleContracts";
import { CandidateCvProgress } from "../../dataPreparation/application/models/candidateDemoCvUpdate";
import { Candidate } from "../../../shared/domain/models/candidate";

/** Executes existing application operations with a fixed, captured configuration. */
export interface CandidateConsoleOperations {
  enrich(request: Extract<OperationRequest, { kind: "enrich" }>, report: (progress: CandidateCvProgress) => void, signal: AbortSignal): Promise<{ changed: number; skipped: number; completedFiles: number; preview: Candidate[] }>;
  fetch(request: Extract<OperationRequest, { kind: "fetch" }>, report: (progress: CandidateBatchExportProgress) => void, signal: AbortSignal): Promise<CandidateBatchCheckpoint>;
  setup(): Promise<string>;
  search(query: string, limit: number): Promise<CandidateSearchResult[]>;
  index(file: string, report: (progress: { processed: number; total: number; indexed: number; skipped: number }) => void, signal: AbortSignal): Promise<{ indexed: number; skipped: number }>;
}
