import { mkdir, open, readFile, unlink, FileHandle } from "node:fs/promises";
import { dirname } from "node:path";

/** Owns the single console writer lock for a workspace, including across ports. */
export class CandidateConsoleWorkspaceLock {
  private handle?: FileHandle;
  constructor(private readonly path: string) {}
  async acquire(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    try { this.handle = await open(this.path, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = Number(await readFile(this.path, "utf8"));
      let alive = true;
      if (Number.isSafeInteger(pid) && pid > 0) {
        try { process.kill(pid, 0); } catch (probe) { if ((probe as NodeJS.ErrnoException).code === "ESRCH") alive = false; }
      }
      if (alive) throw new Error("Another console owns this workspace. Stop it before starting a second console.");
      await unlink(this.path);
      this.handle = await open(this.path, "wx", 0o600);
    }
    await this.handle.writeFile(String(process.pid));
  }
  async release(): Promise<void> {
    if (!this.handle) return;
    await this.handle.close(); this.handle = undefined;
    await unlink(this.path);
  }
}
