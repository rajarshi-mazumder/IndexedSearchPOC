import { Candidate } from "../../domain/entities/candidate";
import { CandidateReadRepository } from "../../application/ports/candidate-read-repository";

export class DummyCandidateRepository implements CandidateReadRepository {
  constructor(private readonly candidates: readonly Candidate[]) {}

  async getAll(): Promise<Candidate[]> {
    return structuredClone([...this.candidates]);
  }

  async getByIds(ids: string[]): Promise<Candidate[]> {
    const selected = new Set(ids);
    return structuredClone(this.candidates.filter((candidate) => selected.has(candidate.id)));
  }
}
