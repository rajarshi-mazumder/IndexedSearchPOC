import { Candidate } from "../../domain/entities/candidate";
import { CandidateReadRepository } from "../ports/candidate-read-repository";
import { CandidateSnapshotStore } from "../ports/candidate-snapshot-store";

// Persist a successful retrieval before making it available to indexing.
export class SnapshottingCandidateRepository implements CandidateReadRepository {
  constructor(
    private readonly source: CandidateReadRepository,
    private readonly snapshot: CandidateSnapshotStore,
  ) {}

  async getAll(): Promise<Candidate[]> {
    const candidates = await this.source.getAll();
    await this.snapshot.save(candidates);
    return candidates;
  }

  async getByIds(ids: string[]): Promise<Candidate[]> {
    const candidates = await this.source.getByIds(ids);
    await this.snapshot.save(candidates);
    return candidates;
  }
}
