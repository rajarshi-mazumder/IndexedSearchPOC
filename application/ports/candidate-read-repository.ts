import { Candidate } from "../../domain/entities/candidate";

export interface CandidateReadRepository {
  getAll(): Promise<Candidate[]>;
  getByIds(ids: string[]): Promise<Candidate[]>;
}
