import { Candidate } from "../../shared/domain/models/candidate";
import { CandidateDocument } from "../../backend/candidateData/models/candidateDocument";
import { PrepareCandidateOpenSearchDocumentService } from "../../backend/dataEmbedding/indexing/application/services/prepareCandidateOpenSearchDocumentService";
import { CandidateDocumentPreparation, PreparedCandidateDocument } from "../../backend/dataEmbedding/indexing/application/ports/candidateDocumentPreparation";
import { GenerateCandidateSkillsTextService } from "../../backend/dataEmbedding/indexing/application/services/generateCandidateSkillsTextService";
import { GenerateCandidateLanguagesTextService } from "../../backend/dataEmbedding/indexing/application/services/generateCandidateLanguagesTextService";
import { GenerateCandidateRegionTextService } from "../../backend/dataEmbedding/indexing/application/services/generateCandidateRegionTextService";
import { GenerateCandidateProfileTestDriver } from "./generateCandidateProfileTestDriver";

/** Keeps the old construction and timestamp boundary in existing focused tests. */
export class PrepareCandidateDocumentTestDriver implements CandidateDocumentPreparation {
  private readonly service: PrepareCandidateOpenSearchDocumentService;

  public constructor(generator: GenerateCandidateProfileTestDriver) {
    this.service = new PrepareCandidateOpenSearchDocumentService(generator, {
      generate: (candidate) => {
        return generator.generateSearchText(candidate);
      },
    }, new GenerateCandidateSkillsTextService(), new GenerateCandidateLanguagesTextService(), new GenerateCandidateRegionTextService());
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
