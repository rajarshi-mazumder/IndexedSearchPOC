import { Candidate } from "../../domain/entities/candidate";

export interface CandidateBatchSource {
  getBatch(limit: number, afterId?: string): Promise<Candidate[]>;
}
