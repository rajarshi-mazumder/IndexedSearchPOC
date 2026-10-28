import { Candidate } from "../../../../../shared/domain/models/candidate";
import { CandidateTextGenerator } from "../ports/candidateTextGenerator";
import { CandidateProfessionalDetailsFormatter } from "../ports/candidateProfessionalDetailsFormatter";
import { CandidateCvTextFormatter } from "../ports/candidateCvTextFormatter";

export class GenerateCandidateDisplayProfileService implements CandidateTextGenerator {
  public constructor(
    private readonly professionalDetails: CandidateProfessionalDetailsFormatter,
    private readonly cvText: CandidateCvTextFormatter,
  ) {}

  public generate(candidate: Candidate): string {
    const parts = [this.describeCurrentRole(candidate)];
    this.appendExpertise(parts, candidate);
    this.appendPersonalDetails(parts, candidate);
    parts.push(...this.professionalDetails.format(candidate));
    parts.push(...this.cvText.format(candidate.enrichment?.cvProfile));
    return parts.join(" ");
  }

  private describeCurrentRole(candidate: Candidate): string {
    if (candidate.title && candidate.company) {
      return `${candidate.name} works as a ${candidate.title} at ${candidate.company}.`;
    }
    if (candidate.title) {
      return `${candidate.name} works as a ${candidate.title}.`;
    }
    if (candidate.company) {
      return `${candidate.name} currently works at ${candidate.company}.`;
    }
    return `Candidate ${candidate.name}.`;
  }

  private appendExpertise(parts: string[], candidate: Candidate): void {
    if (candidate.skills.length > 0) {
      parts.push(`${candidate.name}'s primary skills include ${this.formatList(candidate.skills)}.`);
    }
    if (candidate.skillCategories.length > 0) {
      parts.push(`Their broader areas of expertise include ${this.formatList(candidate.skillCategories)}.`);
    }
    if (candidate.systems.length > 0) {
      parts.push(`They have experience working with ${this.formatList(candidate.systems)}.`);
    }
    if (candidate.jobFunctions.length > 0) {
      parts.push(`Their experience includes ${this.formatList(candidate.jobFunctions)}.`);
    }
    if (candidate.industries.length > 0) {
      parts.push(`They have worked in the ${this.formatList(candidate.industries)} industry.`);
    }
    if (candidate.subIndustries.length > 0) {
      parts.push(`Their industry specialization includes ${this.formatList(candidate.subIndustries)}.`);
    }
  }

  private appendPersonalDetails(parts: string[], candidate: Candidate): void {
    if (candidate.location) {
      parts.push(`They are based in ${candidate.location}.`);
    }
    if (candidate.languages.length > 0) {
      parts.push(`Languages include ${this.formatLanguages(candidate)}.`);
    }
    if (candidate.salary != null) {
      parts.push(`Their current salary is ${candidate.salary}.`);
    }
  }

  private formatLanguages(candidate: Candidate): string {
    const languages: string[] = [];
    for (const language of candidate.languages) {
      languages.push(`${language.code} (${language.level})`);
    }
    return languages.join(", ");
  }

  private formatList(values: string[]): string {
    const unique = new Set<string>();
    for (const value of values) {
      const cleaned = value.trim();
      if (cleaned) {
        unique.add(cleaned);
      }
    }
    const cleaned = [...unique];
    if (cleaned.length === 0) {
      return "";
    }
    if (cleaned.length === 1) {
      return cleaned[0];
    }
    if (cleaned.length === 2) {
      return `${cleaned[0]} and ${cleaned[1]}`;
    }
    return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned.at(-1)}`;
  }
}
