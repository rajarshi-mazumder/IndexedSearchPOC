import { Candidate } from "../../shared/domain/models/candidate";
import { CandidateDocument } from "../../backend/candidateData/models/candidateDocument";
import { PrepareCandidateOpenSearchDocumentService } from "../../backend/dataEmbedding/indexing/application/services/prepareCandidateOpenSearchDocumentService";
import { CandidateDocumentPreparation, PreparedCandidateDocument } from "../../backend/dataEmbedding/indexing/application/ports/candidateDocumentPreparation";
import { GenerateCandidateProfileTestDriver } from "./generateCandidateProfileTestDriver";

/** Keeps the old construction and timestamp boundary in existing focused tests. */
export class PrepareCandidateDocumentTestDriver implements CandidateDocumentPreparation {
  private readonly service: PrepareCandidateOpenSearchDocumentService;

  public constructor(generator: GenerateCandidateProfileTestDriver) {
    this.service = new PrepareCandidateOpenSearchDocumentService(generator, {
      generate: (candidate) => {
        return generator.generateSearchText(candidate);
      },
    });
  }

  public prepare(candidate: Candidate): PreparedCandidateDocument | null {
    return this.service.prepare(candidate);
  }

  public create(candidate: Candidate): CandidateDocument | null {
    const prepared = this.prepare(candidate);
    if (prepared === null) {
      return null;
    }
    return { ...prepared, indexedAt: new Date() };
  }
}
