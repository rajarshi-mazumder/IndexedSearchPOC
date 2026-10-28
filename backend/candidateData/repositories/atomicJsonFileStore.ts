import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
export class AtomicJsonFileStore {
  constructor(private readonly file: string) {}
  async read(fallback: unknown): Promise<unknown> {
    try { return JSON.parse(await readFile(this.file, "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
  }
  async write(value: unknown): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = this.file + "." + randomUUID() + ".tmp";
    try { await writeFile(temporary, JSON.stringify(value, null, 2), { flag: "wx", mode: 0o600 }); await rename(temporary, this.file); }
    finally { await rm(temporary, { force: true }); }
  }
}
