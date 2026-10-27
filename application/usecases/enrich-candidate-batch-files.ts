import { CandidateBatchEditor } from "../ports/candidate-batch-editor";
import { CandidateCvGenerator } from "../ports/candidate-cv-generator";
import { Candidate } from "../../domain/entities/candidate";

export type CandidateCvAction = "preview" | "add" | "regenerate" | "remove";
export interface CandidateCvProgress {
  message: string; file: string; fileNumber: number; fileTotal: number;
  processed: number; total: number; changed: number; skipped: number;
}

export class EnrichCandidateBatchFiles {
  constructor(private readonly batches: CandidateBatchEditor, private readonly generator: CandidateCvGenerator) {}
  execute(files: string[], action: CandidateCvAction, seed: string, report: (progress: CandidateCvProgress) => void, signal: AbortSignal) {
    return this.batches.withLock(async () => {
      let changed = 0, skipped = 0, completedFiles = 0;
      const preview: Candidate[] = [];
      // Preview is deliberately bounded to 20 candidates in the first selected file.
      const selected = [...files].sort();
      for (const [fileIndex, file] of (action === "preview" ? selected.slice(0, 1) : selected).entries()) {
        if (signal.aborted) break;
        const candidates = await this.batches.read(file);
        const source = action === "preview" ? candidates.slice(0, 20) : candidates;
        let fileChanged = 0;
        const transformed = source.map((candidate, index) => {
          const copy = structuredClone(candidate);
          const existing = copy.enrichment?.cvProfile;
          if (action === "remove") {
            if (existing?.source.kind === "synthetic") {
              delete copy.enrichment!.cvProfile;
              copy.enrichment!.cvProfileRemoved = true;
              fileChanged++;
            }
          } else if (!existing || action === "regenerate" || action === "preview") {
            copy.enrichment ??= { version: 2, details: {}, tags: [], associations: [], warnings: [] };
            copy.enrichment.cvProfile = this.generator.generate(copy, seed);
            delete copy.enrichment.cvProfileRemoved;
            fileChanged++;
          }
          if ((index + 1) % 100 === 0) report({ message: `Preparing demo CV: ${file}`, file,
            fileNumber: fileIndex + 1, fileTotal: selected.length, processed: index + 1, total: source.length,
            changed: fileChanged, skipped: index + 1 - fileChanged });
          return copy;
        });
        if (action === "preview") preview.push(...transformed);
        else if (fileChanged) await this.batches.save(file, transformed);
        changed += fileChanged; skipped += source.length - fileChanged; completedFiles++;
        report({ message: action === "preview" ? `Preview ready: ${file} (first ${source.length}; no files changed)`
          : `${file}: ${fileChanged} ${action === "remove" ? "removed" : "enriched"}, ${source.length - fileChanged} skipped. Re-embed changed files.`,
          file, fileNumber: fileIndex + 1, fileTotal: action === "preview" ? 1 : selected.length,
          processed: source.length, total: source.length, changed: fileChanged, skipped: source.length - fileChanged });
        // Let the worker receive a stop request between files.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      return { changed: action === "preview" ? 0 : changed, skipped, completedFiles, preview };
    });
  }
}
