import { Candidate } from "../../domain/entities/candidate";
import { CandidateEnrichment, CandidateTag, CandidateTagAssociation } from "../../domain/entities/candidate-enrichment";

export interface CandidateCoreProfile {
  candidate: Candidate; accountId?: string; modifiedAt?: string; recordType?: string;
  details: CandidateEnrichment["details"]; warnings: string[];
  resolvedDetails?: Record<string, string>;
}
export interface CandidateProfileAssociation extends CandidateTagAssociation { candidateId: string }
export interface CandidateProfileRepository {
  readonly extractionKey: string;
  getBatch(limit: number, afterId?: string): Promise<CandidateCoreProfile[]>;
  getByIds(ids: string[]): Promise<CandidateCoreProfile[]>;
  getAssociations(ids: string[]): Promise<CandidateProfileAssociation[]>;
  getTags(ids: string[]): Promise<CandidateTag[]>;
  getEmployers(ids: string[]): Promise<NonNullable<CandidateEnrichment["employer"]>[]>;
}
