import { CandidateFetchRequest } from "../models/candidateFetchRequest";
import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateBatchCheckpoint } from "../../../candidateData/ports/candidateBatchExportStore";

export interface CandidateFetchCheckpointPlanner {
  validateRequest(input: CandidateFetchRequest): CandidateFetchRequest;
  resumeOrStart(
    options: CandidateFetchRequest,
    checkpoint: CandidateBatchCheckpoint | undefined,
    extractionKey?: string
  ): CandidateBatchCheckpoint;
  validateFetchedBatch(candidates: Candidate[], batchSize: number, checkpoint: CandidateBatchCheckpoint): void;
  afterSavedBatch(checkpoint: CandidateBatchCheckpoint, candidates: Candidate[], batchSize: number): CandidateBatchCheckpoint;
}
