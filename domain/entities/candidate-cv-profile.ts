/** Demo-only professional evidence. Provenance travels with the stored document. */
export interface CandidateCvProfile {
  source: { kind: "synthetic"; generatorVersion: 1; seed: string; archetype: string };
  summary: string;
  technicalSkills: { languages: string[]; frameworks: string[]; databases: string[]; tools: string[] };
  employmentHistory: { employer: string; role: string; location: string; start: string; end: string; responsibilities: string[] }[];
  projects: { name: string; description: string; role: string; technologies: string[]; contributions: string[] }[];
  education: { qualification: string; institution: string; graduationYear: number }[];
  certifications: { name: string; issuer: string; year: number }[];
  languages: { language: string; level: string }[];
}
