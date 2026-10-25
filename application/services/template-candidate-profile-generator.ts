import { CandidateProfileGenerator } from "../ports/candidate-profile-generator";
import { Candidate } from "../../domain/entities/candidate";

export class TemplateCandidateProfileGenerator implements CandidateProfileGenerator {
  generate(candidate: Candidate): string {
    const parts: string[] = [];

    // Identity / role
    if (candidate.title && candidate.company) {
      parts.push(`${candidate.name} works as a ${candidate.title} at ${candidate.company}.`);
    } else if (candidate.title) {
      parts.push(`${candidate.name} works as a ${candidate.title}.`);
    } else if (candidate.company) {
      parts.push(`${candidate.name} currently works at ${candidate.company}.`);
    } else {
      // Just use the name. Don't invent "professional".
      parts.push(`Candidate ${candidate.name}.`);
    }

    // Skills
    if (candidate.skills.length > 0) {
      parts.push(`${candidate.name}'s primary skills include ${this.formatList(candidate.skills)}.`);
    }

    // Skill categories
    if (candidate.skillCategories.length > 0) {
      parts.push(`Their broader areas of expertise include ${this.formatList(candidate.skillCategories)}.`);
    }

    // Systems / technologies
    if (candidate.systems.length > 0) {
      parts.push(`They have experience working with ${this.formatList(candidate.systems)}.`);
    }

    // Job functions
    if (candidate.jobFunctions.length > 0) {
      parts.push(`Their experience includes ${this.formatList(candidate.jobFunctions)}.`);
    }

    // Industry
    if (candidate.industries.length > 0) {
      parts.push(`They have worked in the ${this.formatList(candidate.industries)} industry.`);
    }

    // Sub-industry
    if (candidate.subIndustries.length > 0) {
      parts.push(`Their industry specialization includes ${this.formatList(candidate.subIndustries)}.`);
    }

    // Location
    if (candidate.location) {
      parts.push(`They are based in ${candidate.location}.`);
    }

    // Languages
    if (candidate.languages.length > 0) {
      parts.push(
        `Languages include ${candidate.languages
          .map((language) => `${language.code} (${language.level})`)
          .join(", ")}.`,
      );
    }

    // Salary
    if (candidate.salary != null) {
      parts.push(`Their current salary is ${candidate.salary}.`);
    }

    return parts.join(" ");
  }

  generateSearchText(candidate: Candidate): string {
    const sections: string[] = [];
    if (candidate.title) {
      sections.push(`Role: ${candidate.title}`);
    }
    if (candidate.skills.length) {
      sections.push(`Skills: ${candidate.skills.join(", ")}`);
    }
    if (candidate.skillCategories.length) {
      sections.push(`Expertise: ${candidate.skillCategories.join(", ")}`);
    }
    if (candidate.systems.length) {
      sections.push(`Systems and technologies: ${candidate.systems.join(", ")}`);
    }
    if (candidate.jobFunctions.length) {
      sections.push(`Job functions: ${candidate.jobFunctions.join(", ")}`);
    }
    if (candidate.industries.length) {
      sections.push(`Industries: ${candidate.industries.join(", ")}`);
    }
    if (candidate.subIndustries.length) {
      sections.push(`Specializations: ${candidate.subIndustries.join(", ")}`);
    }
    if (candidate.languages.length) {
      sections.push(
        `Languages: ${candidate.languages
          .map((language) => `${language.code} ${language.level}`)
          .join(", ")}`,
      );
    }
    return sections.join("\n");
  }

  private formatList(values: string[]): string {
    const cleaned = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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
