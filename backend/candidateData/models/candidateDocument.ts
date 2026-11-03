import { Candidate } from "../../../shared/domain/models/candidate";

export interface CandidateDocument {
  salesforceId: string;
  profile: string;
  searchText: string;
  /** Embedded into their own vectors; absent when the candidate has no such data. */
  skillsText?: string;
  languagesText?: string;
  regionText?: string;
  candidate: Candidate;
  indexedAt: Date;
}
