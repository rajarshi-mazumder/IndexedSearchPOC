import { CandidateProfileAssociation } from "../models/candidateProfileAssociation";
import { CandidateCoreProfile } from "../models/candidateCoreProfile";
import { CandidateEnrichment, CandidateTag } from "../../../../shared/domain/models/candidateEnrichment";

export interface CandidateProfileRepository {
  readonly extractionKey: string;
  getBatch(limit: number, afterId?: string): Promise<CandidateCoreProfile[]>;
  getByIds(ids: string[]): Promise<CandidateCoreProfile[]>;
  getAssociations(ids: string[]): Promise<CandidateProfileAssociation[]>;
  getTags(ids: string[]): Promise<CandidateTag[]>;
  getEmployers(ids: string[]): Promise<NonNullable<CandidateEnrichment["employer"]>[]>;
}
