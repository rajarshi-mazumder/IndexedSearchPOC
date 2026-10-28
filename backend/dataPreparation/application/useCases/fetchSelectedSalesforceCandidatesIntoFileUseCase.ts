import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateReadRepository } from "../../../candidateData/ports/candidateReadRepository";

export class FetchSelectedSalesforceCandidatesIntoFileUseCase {
  public constructor(private readonly repository: CandidateReadRepository) { }

  public async execute(ids?: string[]): Promise<{
    fetched: number;
  }> {
    if (ids?.length === 0) {
      return {
        fetched: 0
      };
    }
    const candidates = await this.fetchSelectedCandidates(ids);
    return {
      fetched: candidates.length
    };
  }

  private async fetchSelectedCandidates(ids: string[] | undefined): Promise<Candidate[]> {
    if (ids === undefined) {
      return this.repository.getAll();
    }
    const uniqueIds = [...new Set(ids)];
    return this.repository.getByIds(uniqueIds);
  }
}
