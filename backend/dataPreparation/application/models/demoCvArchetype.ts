/** Employer naming family, so a nurse is not placed at a software studio. */
export type DemoCvSector = "technology" | "finance" | "healthcare" | "industrial" | "consumer" | "professional";

export interface DemoCvProjectTemplate {
  name: string;
  description: string;
  contribution: string;
}

export interface DemoCvSpokenLanguage {
  language: string;
  level: string;
}

/** One synthetic career template. Every value is fictional demo content. */
export interface DemoCvArchetype {
  /** Unique kebab-case identifier stored as `source.archetype`. */
  name: string;
  /** Strong evidence only; tested against each title, skill, system and job function separately. Never use the `g` flag. */
  match: RegExp;
  role: string;
  specialty: string;
  sector: DemoCvSector;
  degree: string;
  languages: readonly string[];
  frameworks: readonly string[];
  databases: readonly string[];
  tools: readonly string[];
  duties: readonly string[];
  projects: readonly DemoCvProjectTemplate[];
  certifications: readonly string[];
  /** Languages the role itself requires (for example a translator's working pair), listed before generated ones. */
  spokenLanguages?: readonly DemoCvSpokenLanguage[];
}
