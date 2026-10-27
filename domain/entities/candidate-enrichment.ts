export type CandidateTagCategory = "skills" | "skillCategories" | "systems" | "industries" | "subIndustries" | "jobFunctions" | "language" | "proficiency";
export interface CandidateTag {
  id: string; label?: string; type?: string; category?: CandidateTagCategory; parentId?: string;
}
export interface CandidateTagAssociation {
  id: string; firstTagId?: string; secondTagId?: string; score?: number; modifiedAt?: string;
}
export interface CandidateEnrichment {
  version: 2;
  modifiedAt?: string;
  recordType?: string;
  details: Record<string, string | number | boolean | null>;
  resolvedDetails?: Record<string, string>;
  employer?: { id: string; name?: string; industry?: string; city?: string; country?: string; description?: string; website?: string };
  tags: CandidateTag[];
  associations: CandidateTagAssociation[];
  warnings: string[];
}
