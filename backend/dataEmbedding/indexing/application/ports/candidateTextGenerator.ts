import { Candidate } from "../../../../../shared/domain/models/candidate";

export interface CandidateTextGenerator {
  generate(candidate: Candidate): string;
}
