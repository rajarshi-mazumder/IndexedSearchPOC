import { CandidateCvProfile } from "../../domain/entities/candidate-cv-profile";

/** Professional content only; identity and generation metadata are not embedding features. */
export class CandidateCvTextFormatter {
  format(cv?: CandidateCvProfile): string[] {
    if (!cv) return [];
    return [cv.summary,
      ...Object.entries(cv.technicalSkills).filter(([, values]) => values.length).map(([category, values]) => `${category}: ${values.join(", ")}`),
      ...cv.employmentHistory.map((job) => `${job.role}, ${job.start} to ${job.end}: ${job.responsibilities.join(" ")}`),
      ...cv.projects.map((project) => `Project: ${project.name}. ${project.description} Role: ${project.role}. Technologies: ${project.technologies.join(", ")}. ${project.contributions.join(" ")}`),
      ...cv.education.map((item) => `Education: ${item.qualification}, ${item.graduationYear}`),
      ...cv.certifications.map((item) => `Training: ${item.name}, ${item.year}`),
      `Spoken languages: ${cv.languages.map((item) => `${item.language} (${item.level})`).join(", ")}`,
    ];
  }
}
