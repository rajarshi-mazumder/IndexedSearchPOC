import { FetchSalesforceCandidatesIntoBatchFilesUseCase } from "../../backend/dataPreparation/application/useCases/fetchSalesforceCandidatesIntoBatchFilesUseCase";
import { CandidateBatchSource } from "../../backend/dataPreparation/application/ports/candidateBatchSource";
import { CandidateBatchExportStore } from "../../backend/candidateData/ports/candidateBatchExportStore";
import { CandidateQualitySummary } from "../../backend/candidateData/services/candidateQualitySummary";
import { PrepareCandidateFetchCheckpointService } from "../../backend/dataPreparation/application/services/prepareCandidateFetchCheckpointService";
export type { CandidateBatchExportProgress } from "../../backend/candidateData/ports/candidateBatchExportProgress";

/** Changes construction only; the existing scenarios and assertions stay intact. */
export class FetchCandidateBatchesTestDriver {
  readonly execute: FetchSalesforceCandidatesIntoBatchFilesUseCase["execute"];
  constructor(source: CandidateBatchSource, files: CandidateBatchExportStore) {
    const useCase = new FetchSalesforceCandidatesIntoBatchFilesUseCase(
      source, files, new PrepareCandidateFetchCheckpointService(), CandidateQualitySummary
    );
    this.execute = useCase.execute.bind(useCase);
  }
}
