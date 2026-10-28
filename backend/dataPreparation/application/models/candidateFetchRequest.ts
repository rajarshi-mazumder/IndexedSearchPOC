export interface CandidateFetchRequest {
  org: string;
  sourceId: string;
  batchSize: number;
  maxBatches: number;
  resume: boolean;
}
