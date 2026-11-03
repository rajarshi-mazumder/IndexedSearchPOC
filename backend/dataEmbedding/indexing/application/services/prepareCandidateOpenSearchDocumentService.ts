import { Candidate } from "../../../../../shared/domain/models/candidate";
import { CandidateDocumentPreparation, PreparedCandidateDocument } from "../ports/candidateDocumentPreparation";
import { CandidateTextGenerator } from "../ports/candidateTextGenerator";

type CandidateAspectTexts = Pick<PreparedCandidateDocument, "skillsText" | "languagesText" | "regionText">;

/** Pure document preparation. The use case supplies the timestamp afterwards. */
export class PrepareCandidateOpenSearchDocumentService implements CandidateDocumentPreparation {
  public constructor(
    private readonly displayProfile: CandidateTextGenerator,
    private readonly searchText: CandidateTextGenerator,
    private readonly skillsText: CandidateTextGenerator,
    private readonly languagesText: CandidateTextGenerator,
    private readonly regionText: CandidateTextGenerator,
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
      ...this.generateAspectTexts(normalized),
    };
  }

  private normalizeCandidate(candidate: Candidate): Candidate {
    return {
      ...candidate,
      skills: [...new Set(candidate.skills)],
    };
  }

  /** Empty texts are left out: the ingest pipeline skips missing fields but rejects empty ones. */
  private generateAspectTexts(candidate: Candidate): CandidateAspectTexts {
    const texts: CandidateAspectTexts = {};
    const skillsText = this.skillsText.generate(candidate).trim();
    if (skillsText) {
      texts.skillsText = skillsText;
    }
    const languagesText = this.languagesText.generate(candidate).trim();
    if (languagesText) {
      texts.languagesText = languagesText;
    }
    const regionText = this.regionText.generate(candidate).trim();
    if (regionText) {
      texts.regionText = regionText;
    }
    return texts;
  }
}
