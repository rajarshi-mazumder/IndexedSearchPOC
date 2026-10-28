import { CandidateCvProfile } from "../../../../../shared/domain/models/candidateCvProfile";
import { CandidateCvTextFormatter } from "../ports/candidateCvTextFormatter";

/** Professional CV content only; identity and synthetic generation metadata stay out. */
export class FormatCandidateCvTextService implements CandidateCvTextFormatter {
  public format(cv?: CandidateCvProfile): string[] {
    if (!cv) {
      return [];
    }
    const sections = [cv.summary];
    sections.push(...this.formatTechnicalSkills(cv));
    sections.push(...this.formatEmploymentHistory(cv));
    sections.push(...this.formatProjects(cv));
    sections.push(...this.formatEducation(cv));
    sections.push(...this.formatCertifications(cv));
    sections.push(this.formatLanguages(cv));
    return sections;
  }

  private formatTechnicalSkills(cv: CandidateCvProfile): string[] {
    const sections: string[] = [];
    for (const [category, values] of Object.entries(cv.technicalSkills)) {
      if (values.length > 0) {
        sections.push(`${category}: ${values.join(", ")}`);
      }
    }
    return sections;
  }

  private formatEmploymentHistory(cv: CandidateCvProfile): string[] {
    const sections: string[] = [];
    for (const job of cv.employmentHistory) {
      sections.push(`${job.role}, ${job.start} to ${job.end}: ${job.responsibilities.join(" ")}`);
    }
    return sections;
  }

  private formatProjects(cv: CandidateCvProfile): string[] {
    const sections: string[] = [];
    for (const project of cv.projects) {
      sections.push(`Project: ${project.name}. ${project.description} Role: ${project.role}. Technologies: ${project.technologies.join(", ")}. ${project.contributions.join(" ")}`);
    }
    return sections;
  }

  private formatEducation(cv: CandidateCvProfile): string[] {
    const sections: string[] = [];
    for (const item of cv.education) {
      sections.push(`Education: ${item.qualification}, ${item.graduationYear}`);
    }
    return sections;
  }

  private formatCertifications(cv: CandidateCvProfile): string[] {
    const sections: string[] = [];
    for (const item of cv.certifications) {
      sections.push(`Training: ${item.name}, ${item.year}`);
    }
    return sections;
  }

  private formatLanguages(cv: CandidateCvProfile): string {
    const languages: string[] = [];
    for (const item of cv.languages) {
      languages.push(`${item.language} (${item.level})`);
    }
    return `Spoken languages: ${languages.join(", ")}`;
  }
}
