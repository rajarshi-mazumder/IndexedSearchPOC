import { Candidate } from "../../../../../shared/domain/models/candidate";
import { CandidateDocumentPreparation, PreparedCandidateDocument } from "../ports/candidateDocumentPreparation";
import { CandidateTextGenerator } from "../ports/candidateTextGenerator";

/** Pure document preparation. The use case supplies the timestamp afterwards. */
export class PrepareCandidateOpenSearchDocumentService implements CandidateDocumentPreparation {
  public constructor(
    private readonly displayProfile: CandidateTextGenerator,
    private readonly searchText: CandidateTextGenerator,
  ) {}

  public prepare(candidate: Candidate): PreparedCandidateDocument | null {
    const normalized = this.normalizeCandidate(candidate);
    const searchText = this.searchText.generate(normalized).trim();
    if (!searchText) {
      return null;
    }
    return {
      salesforceId: normalized.id,
      candidate: normalized,
      profile: this.displayProfile.generate(normalized),
      searchText,
    };
  }

  private normalizeCandidate(candidate: Candidate): Candidate {
    return {
      ...candidate,
      skills: [...new Set(candidate.skills)],
    };
  }
}
