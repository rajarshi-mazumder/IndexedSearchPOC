import { Candidate } from "../../domain/entities/candidate";
import { CandidateReadRepository } from "./candidate-read-repository";

export interface CandidateSnapshotStore extends CandidateReadRepository {
  save(candidates: Candidate[]): Promise<void>;
}
