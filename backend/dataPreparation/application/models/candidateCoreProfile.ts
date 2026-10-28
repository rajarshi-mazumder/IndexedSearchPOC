import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateEnrichment } from "../../../../shared/domain/models/candidateEnrichment";

export interface CandidateCoreProfile {
  candidate: Candidate;
  accountId?: string;
  modifiedAt?: string;
  recordType?: string;
  details: CandidateEnrichment["details"];
  warnings: string[];
  resolvedDetails?: Record<string, string>;
}
