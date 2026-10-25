import { Candidate } from "../../domain/entities/candidate";

export interface CandidateProfileGenerator {
  generate(candidate: Candidate): string;
  generateSearchText(candidate: Candidate): string;
}
