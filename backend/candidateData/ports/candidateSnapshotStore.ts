import { Candidate } from "../../../shared/domain/models/candidate";
import { CandidateReadRepository } from "./candidateReadRepository";

export interface CandidateSnapshotStore extends CandidateReadRepository {
  save(candidates: Candidate[]): Promise<void>;
}
