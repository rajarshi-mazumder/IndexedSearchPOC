import { z } from "zod";
import { CandidateBatchSource } from "../ports/candidate-batch-source";
import { CandidateBatchExportStore, CandidateBatchCheckpoint } from "../ports/candidate-batch-export-store";

const optionsSchema = z.object({
  org: z.string().min(1), sourceId: z.string().min(1),
  batchSize: z.number().int().min(1).max(1000),
  maxBatches: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  resume: z.boolean(),
});

export type CandidateBatchExportProgress =
  | { stage: "fetching"; batchNumber: number; fetched: number }
  | { stage: "saved"; batchNumber: number; fetched: number; count: number; file: string };

export class ExportCandidateBatches {
  constructor(private readonly source: CandidateBatchSource, private readonly store: CandidateBatchExportStore) {}

  async execute(
    input: z.infer<typeof optionsSchema>,
    report: (progress: CandidateBatchExportProgress) => void = () => {},
    signal?: AbortSignal,
  ): Promise<CandidateBatchCheckpoint> {
    const options = optionsSchema.parse(input);
    return this.store.withLock(async () => {
      let checkpoint = await this.store.loadCheckpoint();
      if (checkpoint && !options.resume) throw new Error("Export already exists. Use --resume or choose a new --output-dir.");
      if (!checkpoint && options.resume) throw new Error("No export checkpoint found. Start without --resume.");
      if (checkpoint && (checkpoint.org !== options.org || checkpoint.sourceId !== options.sourceId || checkpoint.batchSize !== options.batchSize)) {
        throw new Error("Resume requires the same Salesforce org, source identity, and batch size as the existing export.");
      }
      if (!checkpoint) {
        checkpoint = { version: 1, org: options.org, sourceId: options.sourceId, batchSize: options.batchSize,
          batchNumber: 0, fetched: 0, complete: false };
        await this.store.saveCheckpoint(checkpoint);
      }
      for (let batch = 0; batch < options.maxBatches && !checkpoint.complete && !signal?.aborted; batch++) {
        const batchNumber: number = checkpoint.batchNumber + 1;
        report({ stage: "fetching", batchNumber, fetched: checkpoint.fetched });
        const candidates = await this.source.getBatch(options.batchSize, checkpoint.lastId);
        const lastId = candidates.at(-1)?.id;
        if (candidates.length > options.batchSize || (lastId !== undefined && lastId === checkpoint.lastId)) {
          throw new Error("Candidate source returned an oversized or non-advancing batch; checkpoint was not advanced.");
        }
        if (!candidates.length) {
          checkpoint = { ...checkpoint, complete: true };
          await this.store.saveCheckpoint(checkpoint);
          break;
        }
        // A file is committed before its cursor. If checkpointing fails, resume
        // re-fetches and replaces only that uncommitted file, never skipping data.
        const file = await this.store.saveBatch(batchNumber, candidates);
        checkpoint = { ...checkpoint, batchNumber, lastId, fetched: checkpoint.fetched + candidates.length,
          complete: candidates.length < options.batchSize };
        await this.store.saveCheckpoint(checkpoint);
        report({ stage: "saved", batchNumber, fetched: checkpoint.fetched, count: candidates.length, file });
      }
      return checkpoint;
    });
  }
}
