import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateCvAction, CandidateCvProgress } from "../models/candidateDemoCvUpdate";
import { DemoCvFileUpdate, DemoCvUpdateResult } from "../models/candidateDemoCvUpdateResult";
import { CandidateDemoCvTransformer } from "../ports/candidateDemoCvTransformer";
import { CandidateStopRequestScheduler } from "../ports/candidateStopRequestScheduler";
import { CandidateBatchEditor } from "../../../candidateData/ports/candidateBatchEditor";

type CvProgressReporter = (progress: CandidateCvProgress) => void;

export class UpdateCandidateDemoCvFilesUseCase {
  public constructor(
    private readonly batches: CandidateBatchEditor,
    private readonly applyDemoCvService: CandidateDemoCvTransformer,
    private readonly stopRequestScheduler: CandidateStopRequestScheduler
  ) { }

  public execute(
    files: string[],
    action: CandidateCvAction,
    seed: string,
    report: CvProgressReporter,
    signal: AbortSignal
  ): Promise<DemoCvUpdateResult> {
    return this.batches.withLock(async () => {
      return this.updateSelectedCandidateFiles(files, action, seed, this.batches, report, signal);
    });
  }

  private async updateSelectedCandidateFiles(
    files: string[],
    action: CandidateCvAction,
    seed: string,
    batches: CandidateBatchEditor,
    report: CvProgressReporter,
    signal: AbortSignal
  ): Promise<DemoCvUpdateResult> {
    const result: DemoCvUpdateResult = {
      changed: 0,
      skipped: 0,
      completedFiles: 0,
      preview: []
    };
    const selected = [...files].sort();
    const filesToProcess = this.selectFilesForCvAction(selected, action);
    for (let fileIndex = 0; fileIndex < filesToProcess.length; fileIndex++) {
      if (signal.aborted) {
        break;
      }
      const file = filesToProcess[fileIndex];
      const candidates = await batches.read(file);
      const source = this.selectCandidatesForCvAction(candidates, action);
      const update = this.transformCandidates(source, action, seed, file, fileIndex, selected.length, report);
      await this.saveOrPreviewCvUpdate(batches, file, action, update, result.preview);
      result.changed += update.changed;
      result.skipped += source.length - update.changed;
      result.completedFiles++;
      this.reportCompletedCvFile(file, fileIndex, selected.length, action, update, report);
      await this.stopRequestScheduler.allowPendingStopRequest();
    }
    if (action === "preview") {
      result.changed = 0;
    }
    return result;
  }

  private selectFilesForCvAction(files: string[], action: CandidateCvAction): string[] {
    if (action === "preview") {
      return files.slice(0, 1);
    }
    return files;
  }

  private selectCandidatesForCvAction(candidates: Candidate[], action: CandidateCvAction): Candidate[] {
    if (action === "preview") {
      return candidates.slice(0, 20);
    }
    return candidates;
  }

  private transformCandidates(
    source: Candidate[],
    action: CandidateCvAction,
    seed: string,
    file: string,
    fileIndex: number,
    fileTotal: number,
    report: CvProgressReporter
  ): DemoCvFileUpdate {
    const update: DemoCvFileUpdate = {
      candidates: [],
      changed: 0
    };
    for (let index = 0; index < source.length; index++) {
      const result = this.applyDemoCvService.apply(source[index], action, seed);
      if (result.changed) {
        update.changed++;
      }
      if ((index + 1) % 100 === 0) {
        report({
          message: `Preparing demo CV: ${file}`,
          file,
          fileNumber: fileIndex + 1,
          fileTotal,
          processed: index + 1,
          total: source.length,
          changed: update.changed,
          skipped: index + 1 - update.changed,
        });
      }
      update.candidates.push(result.candidate);
    }
    return update;
  }

  private async saveOrPreviewCvUpdate(
    batches: CandidateBatchEditor,
    file: string,
    action: CandidateCvAction,
    update: DemoCvFileUpdate,
    preview: Candidate[]
  ): Promise<void> {
    if (action === "preview") {
      preview.push(...update.candidates);
    }
    else if (update.changed > 0) {
      await batches.save(file, update.candidates);
    }
  }

  private reportCompletedCvFile(
    file: string,
    fileIndex: number,
    selectedFileCount: number,
    action: CandidateCvAction,
    update: DemoCvFileUpdate,
    report: CvProgressReporter
  ): void {
    const total = update.candidates.length;
    let fileTotal = selectedFileCount;
    let message: string;
    if (action === "preview") {
      fileTotal = 1;
      message = `Preview ready: ${file} (first ${total}; no files changed)`;
    }
    else {
      let actionDescription = "enriched";
      if (action === "remove") {
        actionDescription = "removed";
      }
      message = `${file}: ${update.changed} ${actionDescription}, ${total - update.changed} skipped. Re-embed changed files.`;
    }
    report({
      message,
      file,
      fileNumber: fileIndex + 1,
      fileTotal,
      processed: total,
      total,
      changed: update.changed,
      skipped: total - update.changed,
    });
  }

}
