import { Candidate } from "../../domain/entities/candidate";

export interface CandidateBatchSource {
  readonly extractionKey?: string;
  getBatch(limit: number, afterId?: string, report?: (message: string) => void): Promise<Candidate[]>;
}
