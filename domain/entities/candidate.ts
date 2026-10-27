import { CandidateEnrichment } from "./candidate-enrichment";

export interface Language {
  code: string;
  level: string;
}

export interface Candidate {
  id: string;
  name: string;
  title?: string;
  company?: string;
  location?: string;
  skills: string[];
  skillCategories: string[];
  systems: string[];
  industries: string[];
  subIndustries: string[];
  jobFunctions: string[];
  languages: Language[];
  salary?: number;
  enrichment?: CandidateEnrichment;
}
