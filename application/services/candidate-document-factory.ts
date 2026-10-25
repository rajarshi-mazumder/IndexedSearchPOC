import { Candidate } from "../../domain/entities/candidate";
import { CandidateDocument } from "../../domain/entities/candidate-document";
import { CandidateProfileGenerator } from "../ports/candidate-profile-generator";

export class CandidateDocumentFactory {
  constructor(private readonly profileGenerator: CandidateProfileGenerator) {}

  create(candidate: Candidate): CandidateDocument | null {
    const normalized = {
      ...candidate,
      skills: [...new Set(candidate.skills)],
    };
    const searchText = this.profileGenerator.generateSearchText(normalized).trim();
    if (!searchText) return null;
    return {
      salesforceId: normalized.id,
      candidate: normalized,
      profile: this.profileGenerator.generate(normalized),
      searchText,
      indexedAt: new Date(),
    };
  }
}
