import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { copyFile, link, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { Candidate } from "../../../shared/domain/models/candidate";
import { CandidateBatchEditor } from "../ports/candidateBatchEditor";
import { LocalCandidateBatchCatalog } from "./localCandidateBatchCatalog";
import { LocalCandidateDatasetLock } from "./localCandidateDatasetLock";
import { CandidateSnapshotSerializer } from "./candidateSnapshotSerializer";
import { JsonCandidateSnapshotStore } from "./jsonCandidateSnapshotStore";

export class CandidateDemoCvFileRepository implements CandidateBatchEditor {
  constructor(private readonly catalog: LocalCandidateBatchCatalog, private readonly dataset: string) {}
  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    return new LocalCandidateDatasetLock(await this.catalog.datasetPath(this.dataset)).withLock(operation);
  }
  async read(file: string): Promise<Candidate[]> {
    await this.catalog.assertCommitted(this.dataset, file);
    const candidates = CandidateSnapshotSerializer.deserialize(await readFile(await this.catalog.filePath(this.dataset, file), "utf8"));
    if (candidates.length > 1000) throw new Error("Enrich files with at most 1,000 candidates.");
    return candidates;
  }
  async save(file: string, candidates: Candidate[]): Promise<void> {
    const path = await this.catalog.filePath(this.dataset, file);
    // Validate before creating a backup or touching the original.
    CandidateSnapshotSerializer.serialize(candidates, new Date());
    const directory = await this.catalog.datasetPath(this.dataset);
    const backup = join(directory, ".cv-backups");
    await mkdir(backup, { recursive: true });
    if (await realpath(backup) !== backup) throw new Error("CV backup directory must not be a symbolic link.");
    const temporaryBackup = join(backup, `.${randomUUID()}.tmp`);
    try {
      await copyFile(path, temporaryBackup, constants.COPYFILE_EXCL);
      // Publish only a complete backup, without overwriting the first original.
      await link(temporaryBackup, join(backup, file)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      });
    } finally { await rm(temporaryBackup, { force: true }); }
    await new JsonCandidateSnapshotStore(path).save(candidates);
  }
}
