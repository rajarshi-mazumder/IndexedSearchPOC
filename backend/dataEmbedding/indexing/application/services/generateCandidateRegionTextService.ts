import { Candidate } from "../../../../../shared/domain/models/candidate";
import { CandidateTextGenerator } from "../ports/candidateTextGenerator";

/** Where the candidate lives, so region queries such as "East Asia" can match "Osaka, Japan". */
export class GenerateCandidateRegionTextService implements CandidateTextGenerator {
  public generate(candidate: Candidate): string {
    if (!candidate.location) {
      return "";
    }
    return this.formatLocation(candidate.location);
  }

  private formatLocation(location: string): string {
    return `Location: ${location}`;
  }
}
