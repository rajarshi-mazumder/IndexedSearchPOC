import { CandidateReadRepository } from "../../backend/candidateData/ports/candidateReadRepository";
import { CandidateDocumentPreparation } from "../../backend/dataEmbedding/indexing/application/ports/candidateDocumentPreparation";
import { CandidateDocumentIndex } from "../../backend/dataEmbedding/indexing/application/ports/candidateDocumentIndex";
import { EmbedCandidatesIntoOpenSearchUseCase } from "../../backend/dataEmbedding/indexing/application/useCases/embedCandidatesIntoOpenSearchUseCase";

/** Adds the clock dependency; all operation logic is inherited from production. */
export class EmbedCandidatesTestDriver extends EmbedCandidatesIntoOpenSearchUseCase {
  public constructor(source: CandidateReadRepository, preparation: CandidateDocumentPreparation, index: CandidateDocumentIndex) {
    super(source, preparation, index, {
      now: () => {
        return new Date();
      },
    });
  }
}
