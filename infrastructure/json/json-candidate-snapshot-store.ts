import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { Candidate } from "../../domain/entities/candidate";
import { CandidateSnapshotStore } from "../../application/ports/candidate-snapshot-store";
import { CandidateSnapshotSerializer } from "./candidate-snapshot-serializer";

export class JsonCandidateSnapshotStore implements CandidateSnapshotStore {
  constructor(private readonly filePath: string) {}

  async save(candidates: Candidate[]): Promise<void> {
    const json = CandidateSnapshotSerializer.serialize(candidates, new Date());
    const directory = dirname(this.filePath);
    await mkdir(directory, { recursive: true });
    const temporaryPath = join(directory, "." + basename(this.filePath) + "." + randomUUID() + ".tmp");
    try {
      await writeFile(temporaryPath, json, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(temporaryPath, this.filePath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  async getAll(): Promise<Candidate[]> {
    let json: string;
    try {
      json = await readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Candidate snapshot not found: ${this.filePath}. Run fetch-candidates or select --source salesforce.`, { cause: error });
      }
      throw error;
    }
    try {
      return CandidateSnapshotSerializer.deserialize(json);
    } catch (error) {
      throw new Error(`Invalid candidate snapshot: ${this.filePath}. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async getByIds(ids: string[]): Promise<Candidate[]> {
    const selected = new Set(ids);
    return (await this.getAll()).filter((candidate) => selected.has(candidate.id));
  }
}
