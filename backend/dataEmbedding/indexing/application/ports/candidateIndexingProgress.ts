export interface CandidateIndexingProgress {
  processed: number;
  total: number;
  indexed: number;
  skipped: number;
}

export interface CandidateIndexingResult {
  indexed: number;
  skipped: number;
  deleted?: number;
}
