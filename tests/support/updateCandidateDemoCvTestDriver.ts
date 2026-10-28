import { UpdateCandidateDemoCvFilesUseCase } from "../../backend/dataPreparation/application/useCases/updateCandidateDemoCvFilesUseCase";
import { CandidateBatchEditor } from "../../backend/candidateData/ports/candidateBatchEditor";
import { CandidateCvGenerator } from "../../backend/dataPreparation/application/ports/candidateCvGenerator";
import { CandidateCvAction, CandidateCvProgress } from "../../backend/dataPreparation/application/models/candidateDemoCvUpdate";
import { ApplyDemoCvToCandidateService } from "../../backend/dataPreparation/application/services/applyDemoCvToCandidateService";

/** Keeps existing CV assertions while constructing the separated use case. */
export class UpdateCandidateDemoCvTestDriver {
  private readonly useCase: UpdateCandidateDemoCvFilesUseCase;
  constructor(batches: CandidateBatchEditor, generator: CandidateCvGenerator) {
    this.useCase = new UpdateCandidateDemoCvFilesUseCase(batches, new ApplyDemoCvToCandidateService(generator), {
      allowPendingStopRequest: async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
      },
    });
  }
  execute(files: string[], action: CandidateCvAction, seed: string, report: (progress: CandidateCvProgress) => void, signal: AbortSignal) {
    return this.useCase.execute(files, action, seed, report, signal);
  }
}
