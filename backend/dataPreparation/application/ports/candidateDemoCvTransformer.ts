import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateCvAction } from "../models/candidateDemoCvUpdate";

export interface CandidateDemoCvTransformer {
  apply(candidate: Candidate, action: CandidateCvAction, seed: string): {
    candidate: Candidate;
    changed: boolean;
  };
}
