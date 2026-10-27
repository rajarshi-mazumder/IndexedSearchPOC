import type { Candidate } from "../domain/entities/candidate";

export interface ConsoleConfiguration {
  id: string; name: string; sfOrg: string; awsProfile: string; awsRegion: string;
  endpoint: string; modelId: string; roleArn: string; index: string;
  automaticPipelines: boolean; ingestPipeline: string; searchPipeline: string; dataset: string;
}
export type OperationRequest =
  | { kind: "fetch"; configuration: ConsoleConfiguration; batchSize: number; maxBatches: number; resume: boolean }
  | { kind: "setup"; configuration: ConsoleConfiguration }
  | { kind: "embed"; configuration: ConsoleConfiguration; files: string[] }
  | { kind: "search"; configuration: ConsoleConfiguration; query: string; limit: number };
export interface OperationProgress {
  message: string; processed?: number; total?: number; indexed?: number; skipped?: number;
  fetched?: number; batchNumber?: number; file?: string; fileNumber?: number; fileTotal?: number;
}
export interface FileEmbeddingResult {
  file: string; indexed: number; skipped: number; hash: string; size: number; modifiedAt: string;
}
export interface ConsoleSearchResult { rank: number; score: number; candidate: Candidate; profile: string }
export interface OperationResult {
  modelId?: string; fetched?: number; batchNumber?: number; complete?: boolean;
  files?: FileEmbeddingResult[]; candidates?: ConsoleSearchResult[];
}
export type OperationStatus = "running" | "stopping" | "succeeded" | "failed" | "cancelled" | "interrupted";
export interface OperationSummary {
  id: string; kind: OperationRequest["kind"]; status: OperationStatus;
  profileName: string; index: string; dataset: string; startedAt: string; finishedAt?: string;
  progress: OperationProgress; error?: string;
}
export interface OperationRecord extends OperationSummary {
  request: OperationRequest; events: { at: string; message: string }[]; result?: OperationResult;
}
export interface BatchFile {
  name: string; size: number; modifiedAt: string; committed: boolean; records?: number;
  lastEmbedding?: { at: string; indexed: number; skipped: number; changed: boolean };
}
export interface DatasetListing {
  dataset: string; files: BatchFile[]; totalFiles: number; page: number; pageSize: number;
  checkpoint?: { org: string; fetched: number; batchNumber: number; batchSize: number; complete: boolean };
}
export interface CandidatePreview { candidates: Candidate[]; total: number; page: number; pageSize: number }
export type WorkerEvent =
  | { type: "progress"; progress: OperationProgress }
  | { type: "file"; result: FileEmbeddingResult }
  | { type: "result"; result: OperationResult; cancelled: boolean }
  | { type: "error"; message: string };
