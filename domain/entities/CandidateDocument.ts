import { Candidate } from "./Candidate";

export interface CandidateDocument {
  salesforceId: string;
  profile: string;
  embedding: number[];
  candidate: Candidate;
  indexedAt: Date;
}
