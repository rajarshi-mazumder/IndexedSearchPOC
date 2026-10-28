import { Candidate } from "../../../../../shared/domain/models/candidate";

export interface CandidateProfessionalDetailsFormatter {
  format(candidate: Candidate): string[];
}
