import { Candidate } from "../../../../../shared/domain/models/candidate";
import { CandidateTextGenerator } from "../ports/candidateTextGenerator";

/** Expertise only, so the skills vector is compared with skill queries without role or CV narrative. */
export class GenerateCandidateSkillsTextService implements CandidateTextGenerator {
  public generate(candidate: Candidate): string {
    const sections: string[] = [];
    this.appendList(sections, "Skills", candidate.skills);
    this.appendList(sections, "Expertise", candidate.skillCategories);
    this.appendList(sections, "Systems and technologies", candidate.systems);
    this.appendList(sections, "Technical skills", this.collectCvTechnicalSkills(candidate));
    return sections.join("\n");
  }

  private collectCvTechnicalSkills(candidate: Candidate): string[] {
    const technicalSkills = candidate.enrichment?.cvProfile?.technicalSkills;
    if (!technicalSkills) {
      return [];
    }
    return [...new Set(Object.values(technicalSkills).flat())];
  }

  private appendList(sections: string[], label: string, values: string[]): void {
    if (values.length > 0) {
      sections.push(`${label}: ${values.join(", ")}`);
    }
  }
}
