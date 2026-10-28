import { z } from "zod";
import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateBatchCheckpoint } from "../../../candidateData/ports/candidateBatchExportStore";
import { CandidateFetchCheckpointPlanner } from "../ports/candidateFetchCheckpointPlanner";
import { CandidateFetchRequest } from "../models/candidateFetchRequest";

const optionsSchema = z.object({
  org: z.string().min(1),
  sourceId: z.string().min(1),
  batchSize: z.number().int().min(1).max(1000),
  maxBatches: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  resume: z.boolean(),
});

/** Pure resume/cursor rules. Saving the file before its checkpoint is orchestration. */
export class PrepareCandidateFetchCheckpointService implements CandidateFetchCheckpointPlanner {
  public validateRequest(input: CandidateFetchRequest): CandidateFetchRequest {
    return optionsSchema.parse(input);
  }

  public resumeOrStart(
    options: CandidateFetchRequest,
    checkpoint: CandidateBatchCheckpoint | undefined,
    extractionKey?: string
  ): CandidateBatchCheckpoint {
    if (checkpoint && !options.resume) {
      throw new Error("Export already exists. Use --resume or choose a new --output-dir.");
    }
    if (!checkpoint && options.resume) {
      throw new Error("No export checkpoint found. Start without --resume.");
    }
    if (checkpoint && checkpoint.extractionKey !== extractionKey) {
      throw new Error("Extraction version or scope changed. Choose a new dataset/output directory; old and enriched exports cannot be mixed.");
    }
    if (checkpoint && (checkpoint.org !== options.org || checkpoint.sourceId !== options.sourceId || checkpoint.batchSize !== options.batchSize)) {
      throw new Error("Resume requires the same Salesforce org, source identity, and batch size as the existing export.");
    }
    if (checkpoint) {
      return checkpoint;
    }
    return this.createInitialCheckpoint(options, extractionKey);
  }

  public validateFetchedBatch(candidates: Candidate[], batchSize: number, checkpoint: CandidateBatchCheckpoint): void {
    const lastId = candidates.at(-1)?.id;
    if (candidates.length > batchSize || (lastId !== undefined && lastId === checkpoint.lastId)) {
      throw new Error("Candidate source returned an oversized or non-advancing batch; checkpoint was not advanced.");
    }
  }

  public afterSavedBatch(checkpoint: CandidateBatchCheckpoint, candidates: Candidate[], batchSize: number): CandidateBatchCheckpoint {
    return {
      ...checkpoint,
      batchNumber: checkpoint.batchNumber + 1,
      lastId: candidates.at(-1)?.id,
      fetched: checkpoint.fetched + candidates.length,
      complete: candidates.length < batchSize
    };
  }

  private createInitialCheckpoint(options: CandidateFetchRequest, extractionKey?: string): CandidateBatchCheckpoint {
    return {
      version: 1,
      extractionKey,
      org: options.org,
      sourceId: options.sourceId,
      batchSize: options.batchSize,
      batchNumber: 0,
      fetched: 0,
      complete: false,
    };
  }
}
