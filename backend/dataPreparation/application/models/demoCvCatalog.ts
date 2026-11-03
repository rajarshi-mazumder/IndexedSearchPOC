import { DemoCvArchetype, DemoCvSector } from "./demoCvArchetype";

export interface DemoCvSeniorityLevel {
  minimumYears: number;
  /** Empty for the unprefixed mid-level title. */
  prefix: string;
  teamResponsibility: string;
}

export interface DemoCvEmploymentPools {
  employerPrefixes: readonly string[];
  employerSuffixes: Readonly<Record<DemoCvSector, readonly string[]>>;
  locations: readonly string[];
  seniorityLevels: readonly DemoCvSeniorityLevel[];
  projectReviewContributions: readonly string[];
}

export interface DemoCvCredentialPools {
  institutions: readonly string[];
  certificationIssuers: readonly string[];
}

export interface DemoCvSpokenLanguagePools {
  /** Candidate's first language when it is not Japanese. */
  nativeLanguages: readonly string[];
  /** Optional third language. */
  additionalLanguages: readonly string[];
  /** Proficiency for non-native languages. */
  levels: readonly string[];
}

/** Everything the synthetic CV generator may draw from. Pure data: no I/O, clock or randomness. */
export interface DemoCvCatalog {
  archetypes: readonly DemoCvArchetype[];
  employment: DemoCvEmploymentPools;
  credentials: DemoCvCredentialPools;
  spokenLanguages: DemoCvSpokenLanguagePools;
  /** Placeholders: {role}, {years}, {specialty}, {firstProject}, {secondProject}. */
  summaryTemplates: readonly string[];
}
