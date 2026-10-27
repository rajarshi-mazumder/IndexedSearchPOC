import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";

/** Shared by export, local enrichment, and JSON indexing across processes. */
export class LocalCandidateDatasetLock {
  constructor(private readonly directory: string) {}
  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true });
    // Keep the original filename to coordinate with existing exporters.
    const path = join(this.directory, ".export.lock");
    const lock = await open(path, "wx", 0o600).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "EEXIST") throw new Error(`Dataset is locked: ${path}. Wait for fetch, enrichment or embedding to finish. After a killed process, confirm it has stopped before removing the lock.`);
      throw error;
    });
    try { await lock.writeFile(JSON.stringify({ pid: process.pid })); return await operation(); }
    finally { await lock.close(); await rm(path, { force: true }); }
  }
}
