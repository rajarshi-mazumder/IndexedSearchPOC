import { Candidate } from "../../domain/entities/Candidate";

export interface CandidateReadRepository {
  getAll(): Promise<Candidate[]>;
  getByIds(ids: string[]): Promise<Candidate[]>;
}

export interface CandidateChangeRepository {
  getChangedIdsSince(date: Date): Promise<string[]>;
}
