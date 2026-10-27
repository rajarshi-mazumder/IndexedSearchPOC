import { Candidate } from "../../domain/entities/candidate";
import { CandidateCvProfile } from "../../domain/entities/candidate-cv-profile";

export interface CandidateCvGenerator {
  generate(candidate: Candidate, seed: string): CandidateCvProfile;
}
