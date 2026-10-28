import { Candidate } from "../../../shared/domain/models/candidate";

export interface CandidateReadRepository {
  getAll(): Promise<Candidate[]>;
  getByIds(ids: string[]): Promise<Candidate[]>;
}
