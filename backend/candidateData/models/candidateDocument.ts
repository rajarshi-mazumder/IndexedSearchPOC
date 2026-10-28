import { Candidate } from "../../../shared/domain/models/candidate";

export interface CandidateDocument {
  salesforceId: string;
  profile: string;
  searchText: string;
  candidate: Candidate;
  indexedAt: Date;
}
