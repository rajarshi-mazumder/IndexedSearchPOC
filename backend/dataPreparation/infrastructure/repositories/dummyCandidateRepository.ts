import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateReadRepository } from "../../../candidateData/ports/candidateReadRepository";

export class DummyCandidateRepository implements CandidateReadRepository {
  public constructor(private readonly candidates: readonly Candidate[]) { }

  public async getAll(): Promise<Candidate[]> {
    return structuredClone([...this.candidates]);
  }

  public async getByIds(ids: string[]): Promise<Candidate[]> {
    const candidates = this.selectCandidatesById(ids);
    return structuredClone(candidates);
  }

  private selectCandidatesById(ids: string[]): Candidate[] {
    const selectedIds = new Set(ids);
    const candidates: Candidate[] = [];
    for (const candidate of this.candidates) {
      if (selectedIds.has(candidate.id)) {
        candidates.push(candidate);
      }
    }
    return candidates;
  }
}
