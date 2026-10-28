import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateFetchRequest } from "../models/candidateFetchRequest";
import { CandidateFetchCheckpointPlanner } from "../ports/candidateFetchCheckpointPlanner";
import { CandidateBatchSource } from "../ports/candidateBatchSource";
import { CandidateQualitySummarizer } from "../ports/candidateQualitySummarizer";
import { CandidateBatchCheckpoint, CandidateBatchExportStore } from "../../../candidateData/ports/candidateBatchExportStore";
import { CandidateBatchExportProgress } from "../../../candidateData/ports/candidateBatchExportProgress";

type FetchProgressReporter = (progress: CandidateBatchExportProgress) => void;

export class FetchSalesforceCandidatesIntoBatchFilesUseCase {
  public constructor(
    private readonly source: CandidateBatchSource,
    private readonly files: CandidateBatchExportStore,
    private readonly checkpointService: CandidateFetchCheckpointPlanner,
    private readonly qualitySummary: CandidateQualitySummarizer
  ) { }

  public async execute(
    input: CandidateFetchRequest,
    report: FetchProgressReporter = () => { },
    signal?: AbortSignal
  ): Promise<CandidateBatchCheckpoint> {
    const options = this.checkpointService.validateRequest(input);
    return this.files.withLock(async () => {
      const checkpoint = await this.loadOrCreateCheckpoint(options, this.source, this.files);
      return this.fetchAndSaveRequestedBatches(options, checkpoint, this.source, this.files, report, signal);
    });
  }

  private async loadOrCreateCheckpoint(
    options: CandidateFetchRequest,
    source: CandidateBatchSource,
    files: CandidateBatchExportStore
  ): Promise<CandidateBatchCheckpoint> {
    const previousCheckpoint = await files.loadCheckpoint();
    const checkpoint = this.checkpointService.resumeOrStart(options, previousCheckpoint, source.extractionKey);
    if (!previousCheckpoint) {
      await files.saveCheckpoint(checkpoint);
    }
    return checkpoint;
  }

  private async fetchAndSaveRequestedBatches(
    options: CandidateFetchRequest,
    checkpoint: CandidateBatchCheckpoint,
    source: CandidateBatchSource,
    files: CandidateBatchExportStore,
    report: FetchProgressReporter,
    signal?: AbortSignal
  ): Promise<CandidateBatchCheckpoint> {
    for (let batch = 0; batch < options.maxBatches && !checkpoint.complete && !signal?.aborted; batch++) {
      const batchNumber = checkpoint.batchNumber + 1;
      const candidates = await this.fetchNextBatch(source, options.batchSize, checkpoint, report);
      this.checkpointService.validateFetchedBatch(candidates, options.batchSize, checkpoint);
      if (candidates.length === 0) {
        checkpoint = {
          ...checkpoint,
          complete: true
        };
        await files.saveCheckpoint(checkpoint);
        break;
      }
      // Commit the file before its cursor so a retry never skips unsaved candidates.
      const file = await files.saveBatch(batchNumber, candidates);
      this.reportBatchQuality(candidates, checkpoint, report);
      checkpoint = this.checkpointService.afterSavedBatch(checkpoint, candidates, options.batchSize);
      await files.saveCheckpoint(checkpoint);
      report({
        stage: "saved",
        batchNumber,
        fetched: checkpoint.fetched,
        count: candidates.length,
        file
      });
    }
    return checkpoint;
  }

  private async fetchNextBatch(
    source: CandidateBatchSource,
    batchSize: number,
    checkpoint: CandidateBatchCheckpoint,
    report: FetchProgressReporter
  ): Promise<Candidate[]> {
    const batchNumber = checkpoint.batchNumber + 1;
    report({
      stage: "fetching",
      batchNumber,
      fetched: checkpoint.fetched
    });
    return source.getBatch(batchSize, checkpoint.lastId, (message) => {
      report({
        stage: "fetching",
        batchNumber,
        fetched: checkpoint.fetched,
        message
      });
    });
  }

  private reportBatchQuality(
    candidates: Candidate[],
    checkpoint: CandidateBatchCheckpoint,
    report: FetchProgressReporter
  ): void {
    const quality = this.qualitySummary.summarize(candidates);
    report({
      stage: "fetching",
      batchNumber: checkpoint.batchNumber + 1,
      fetched: checkpoint.fetched,
      message: `Batch quality: ${quality.withSkills}/${quality.total} with skills, ${quality.withSystems} with technologies, ${quality.withLanguages} with languages, ${quality.withWarnings} with warnings; ${quality.associations} associations`,
    });
  }

}
