import { Candidate } from "../../shared/domain/models/candidate";
import { FormatCandidateCvTextService } from "../../backend/dataEmbedding/indexing/application/services/formatCandidateCvTextService";
import { FormatCandidateProfessionalDetailsService } from "../../backend/dataEmbedding/indexing/application/services/formatCandidateProfessionalDetailsService";
import { GenerateCandidateDisplayProfileService } from "../../backend/dataEmbedding/indexing/application/services/generateCandidateDisplayProfileService";
import { GenerateCandidateSearchTextService } from "../../backend/dataEmbedding/indexing/application/services/generateCandidateSearchTextService";

/** Construction-only bridge for unchanged focused test inputs and assertions. */
export class GenerateCandidateProfileTestDriver {
  private readonly displayProfile: GenerateCandidateDisplayProfileService;
  private readonly searchText: GenerateCandidateSearchTextService;

  public constructor() {
    const details = new FormatCandidateProfessionalDetailsService();
    const cv = new FormatCandidateCvTextService();
    this.displayProfile = new GenerateCandidateDisplayProfileService(details, cv);
    this.searchText = new GenerateCandidateSearchTextService(details, cv);
  }

  public generate(candidate: Candidate): string {
    return this.displayProfile.generate(candidate);
  }

  public generateSearchText(candidate: Candidate): string {
    return this.searchText.generate(candidate);
  }
}
