import { Candidate } from "../../../../../shared/domain/models/candidate";
import { CandidateTextGenerator } from "../ports/candidateTextGenerator";
import { CandidateProfessionalDetailsFormatter } from "../ports/candidateProfessionalDetailsFormatter";
import { CandidateCvTextFormatter } from "../ports/candidateCvTextFormatter";

export class GenerateCandidateSearchTextService implements CandidateTextGenerator {
  public constructor(
    private readonly professionalDetails: CandidateProfessionalDetailsFormatter,
    private readonly cvText: CandidateCvTextFormatter,
  ) {}

  public generate(candidate: Candidate): string {
    const sections: string[] = [];
    if (candidate.title) {
      sections.push(`Role: ${candidate.title}`);
    }
    this.appendList(sections, "Skills", candidate.skills);
    this.appendList(sections, "Expertise", candidate.skillCategories);
    this.appendList(sections, "Systems and technologies", candidate.systems);
    this.appendList(sections, "Job functions", candidate.jobFunctions);
    this.appendList(sections, "Industries", candidate.industries);
    this.appendList(sections, "Specializations", candidate.subIndustries);
    this.appendLanguages(sections, candidate);
    sections.push(...this.professionalDetails.format(candidate));
    sections.push(...this.cvText.format(candidate.enrichment?.cvProfile));
    return sections.join("\n");
  }

  private appendList(sections: string[], label: string, values: string[]): void {
    if (values.length > 0) {
      sections.push(`${label}: ${values.join(", ")}`);
    }
  }

  private appendLanguages(sections: string[], candidate: Candidate): void {
    if (candidate.languages.length === 0) {
      return;
    }
    const languages: string[] = [];
    for (const language of candidate.languages) {
      languages.push(`${language.code} ${language.level}`);
    }
    sections.push(`Languages: ${languages.join(", ")}`);
  }
}
