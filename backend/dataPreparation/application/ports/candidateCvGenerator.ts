import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateCvProfile } from "../../../../shared/domain/models/candidateCvProfile";

export interface CandidateCvGenerator {
  generate(candidate: Candidate, seed: string): CandidateCvProfile;
}
