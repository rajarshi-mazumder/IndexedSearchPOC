import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateReadRepository } from "../../../candidateData/ports/candidateReadRepository";
import { CandidateSnapshotStore } from "../../../candidateData/ports/candidateSnapshotStore";
// Persist a successful retrieval before making it available to indexing.

export class PersistFetchedCandidatesRepository implements CandidateReadRepository {
  public constructor(
    private readonly source: CandidateReadRepository,
    private readonly snapshot: CandidateSnapshotStore
  ) { }

  public async getAll(): Promise<Candidate[]> {
    const candidates = await this.source.getAll();
    return this.saveRetrievedCandidates(candidates);
  }

  public async getByIds(ids: string[]): Promise<Candidate[]> {
    const candidates = await this.source.getByIds(ids);
    return this.saveRetrievedCandidates(candidates);
  }

  private async saveRetrievedCandidates(candidates: Candidate[]): Promise<Candidate[]> {
    await this.snapshot.save(candidates);
    return candidates;
  }
}
