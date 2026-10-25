import { Candidate } from "./candidate";

export interface CandidateDocument {
  salesforceId: string;
  profile: string;
  searchText: string;
  candidate: Candidate;
  indexedAt: Date;
}
