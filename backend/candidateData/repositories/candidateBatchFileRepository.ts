import { LocalCandidateDatasetLock } from "./localCandidateDatasetLock";
import { randomUUID } from "node:crypto";
import { readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { Candidate } from "../../../shared/domain/models/candidate";
import { CandidateBatchCheckpoint, CandidateBatchExportStore } from "../ports/candidateBatchExportStore";
import { JsonCandidateSnapshotStore } from "./jsonCandidateSnapshotStore";

const checkpointSchema = z.object({
  version: z.literal(1), org: z.string().min(1), sourceId: z.string().min(1),
  extractionKey: z.string().optional(),
  batchSize: z.number().int().min(1).max(1000), batchNumber: z.number().int().nonnegative(),
  fetched: z.number().int().nonnegative(), lastId: z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/).optional(),
  complete: z.boolean(),
}).strict().refine((state) => state.batchNumber === 0
  ? state.fetched === 0 && state.lastId === undefined
  : state.lastId !== undefined && state.fetched > (state.batchNumber - 1) * state.batchSize && state.fetched <= state.batchNumber * state.batchSize,
"Invalid export checkpoint counts or cursor");

export class CandidateBatchFileRepository implements CandidateBatchExportStore {
  constructor(private readonly directory: string) {}

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    return new LocalCandidateDatasetLock(this.directory).withLock(operation);
  }

  async loadCheckpoint(): Promise<CandidateBatchCheckpoint | undefined> {
    let json: string;
    try {
      json = await readFile(join(this.directory, "checkpoint.json"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if ((await readdir(this.directory)).some((name) => /^batch-\d+\.json$/.test(name))) {
        throw new Error("Batch files exist without a checkpoint. Choose a new --output-dir.");
      }
      return undefined;
    }
    const checkpoint = checkpointSchema.parse(JSON.parse(json));
    if (checkpoint.batchNumber) {
      const candidates = await new JsonCandidateSnapshotStore(this.batchPath(checkpoint.batchNumber)).getAll();
      const expectedCount = checkpoint.fetched - (checkpoint.batchNumber - 1) * checkpoint.batchSize;
      if (candidates.length !== expectedCount || candidates.at(-1)?.id !== checkpoint.lastId) {
        throw new Error("The last committed batch does not match its checkpoint. Restore the original export or use a new directory.");
      }
    }
    return checkpoint;
  }

  async saveCheckpoint(checkpoint: CandidateBatchCheckpoint): Promise<void> {
    const json = JSON.stringify(checkpointSchema.parse(checkpoint), null, 2) + "\n";
    const temporaryPath = join(this.directory, ".checkpoint." + randomUUID() + ".tmp");
    try {
      await writeFile(temporaryPath, json, { flag: "wx", mode: 0o600 });
      await rename(temporaryPath, join(this.directory, "checkpoint.json"));
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  async saveBatch(batchNumber: number, candidates: Candidate[]): Promise<string> {
    const path = this.batchPath(batchNumber);
    await new JsonCandidateSnapshotStore(path).save(candidates);
    return path;
  }

  private batchPath(batchNumber: number): string {
    return join(this.directory, "batch-" + String(batchNumber).padStart(6, "0") + ".json");
  }
}
