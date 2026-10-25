import { CandidateReadRepository } from "../ports/candidate-read-repository";

export class ExportCandidateSnapshot {
  constructor(private readonly repository: CandidateReadRepository) {}

  async execute(ids?: string[]): Promise<{ fetched: number }> {
    if (ids?.length === 0) return { fetched: 0 };
    const candidates = ids === undefined
      ? await this.repository.getAll()
      : await this.repository.getByIds([...new Set(ids)]);
    return { fetched: candidates.length };
  }
}
