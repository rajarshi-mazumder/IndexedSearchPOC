import { mkdir, readdir, readFile, realpath, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { CandidateBatchCatalog } from "../../application/ports/candidate-batch-catalog";
import { batchFileNameSchema, datasetNameSchema } from "../../application/services/candidate-console-validation";
import { CandidatePreview, DatasetListing } from "../../shared/candidate-console-contracts";
import { CandidateSnapshotSerializer } from "./candidate-snapshot-serializer";

const checkpointSchema = z.object({ org: z.string(), fetched: z.number().int().nonnegative(), batchNumber: z.number().int().nonnegative(),
  batchSize: z.number().int().min(1).max(1000), complete: z.boolean() });

export class LocalCandidateBatchCatalog implements CandidateBatchCatalog {
  constructor(private readonly root: string) {}
  async datasetPath(dataset: string, create = false): Promise<string> {
    datasetNameSchema.parse(dataset);
    await mkdir(this.root, { recursive: true });
    const root = await realpath(this.root);
    const path = resolve(root, dataset);
    if (create) await mkdir(path, { recursive: true });
    try {
      const actual = await realpath(path);
      if (!actual.startsWith(root + sep)) throw new Error("Dataset must stay inside .cache/candidates.");
      return actual;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return path; throw error; }
  }
  async filePath(dataset: string, file: string): Promise<string> {
    batchFileNameSchema.parse(file);
    const directory = await this.datasetPath(dataset);
    const path = await realpath(join(directory, file));
    if (dirname(path) !== directory) throw new Error("Batch file must stay inside its dataset folder.");
    const details = await stat(path);
    if (!details.isFile() || details.size > 32 * 1024 * 1024) throw new Error("Batch files must be JSON files smaller than 32 MB.");
    return path;
  }
  async fingerprint(dataset: string, file: string): Promise<{ hash: string; size: number; modifiedAt: string }> {
    const path = await this.filePath(dataset, file);
    const bytes = await readFile(path); const details = await stat(path);
    return { hash: createHash("sha256").update(bytes).digest("hex"), size: bytes.length, modifiedAt: details.mtime.toISOString() };
  }
  async assertCommitted(dataset: string, file: string): Promise<void> {
    batchFileNameSchema.parse(file);
    const checkpoint = checkpointSchema.parse(JSON.parse(await readFile(join(await this.datasetPath(dataset), "checkpoint.json"), "utf8")));
    const number = Number(file.slice(6, -5));
    if (number < 1 || number > checkpoint.batchNumber) throw new Error(`Batch ${file} is not committed by the export checkpoint.`);
  }
  async datasets(): Promise<string[]> {
    await mkdir(this.root, { recursive: true });
    return (await readdir(this.root, { withFileTypes: true })).filter((item) => item.isDirectory() && datasetNameSchema.safeParse(item.name).success)
      .map((item) => item.name).sort();
  }
  async list(dataset: string, page: number, pageSize: number): Promise<DatasetListing> {
    const directory = await this.datasetPath(dataset);
    const result: DatasetListing = { dataset, files: [], totalFiles: 0, page, pageSize };
    let names: string[];
    try { names = (await readdir(directory)).filter((name) => batchFileNameSchema.safeParse(name).success).sort(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return result; throw error; }
    try { result.checkpoint = checkpointSchema.parse(JSON.parse(await readFile(join(directory, "checkpoint.json"), "utf8"))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    result.totalFiles = names.length;
    for (const name of names.slice((page - 1) * pageSize, page * pageSize)) {
      const path = await this.filePath(dataset, name); const details = await stat(path);
      const number = Number(name.slice(6, -5)); const checkpoint = result.checkpoint;
      const committed = checkpoint !== undefined && number <= checkpoint.batchNumber;
      const records = !committed ? undefined : number === checkpoint.batchNumber
        ? checkpoint.fetched - (number - 1) * checkpoint.batchSize : checkpoint.batchSize;
      result.files.push({ name, size: details.size, modifiedAt: details.mtime.toISOString(), committed, records });
    }
    return result;
  }
  async preview(dataset: string, file: string, page: number, pageSize: number): Promise<CandidatePreview> {
    const candidates = CandidateSnapshotSerializer.deserialize(await readFile(await this.filePath(dataset, file), "utf8"));
    if (candidates.length > 1000) throw new Error("Use batch files with at most 1,000 candidates.");
    return { candidates: candidates.slice((page - 1) * pageSize, page * pageSize), total: candidates.length, page, pageSize };
  }
}
