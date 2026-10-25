import { CandidateReadRepository } from "../ports/candidate-read-repository";
import { CandidateDocumentIndex } from "../ports/candidate-document-index";
import { CandidateDocumentFactory } from "../services/candidate-document-factory";

export class IndexCandidates {
  constructor(
    private readonly repository: CandidateReadRepository,
    private readonly documentFactory: CandidateDocumentFactory,
    private readonly documentIndex: CandidateDocumentIndex,
  ) {}

  // Omitted IDs select all candidates; an explicit empty selection does no work.
  async execute(ids?: string[]): Promise<{ indexed: number; skipped: number }> {
    if (ids?.length === 0) return { indexed: 0, skipped: 0 };
    const candidates = ids === undefined
      ? await this.repository.getAll()
      : await this.repository.getByIds([...new Set(ids)]);
    let indexed = 0;
    // Bound document preparation memory independently of the adapter's bulk limit.
    for (let offset = 0; offset < candidates.length; offset += 100) {
      const documents = candidates.slice(offset, offset + 100)
        .map((candidate) => this.documentFactory.create(candidate))
        .filter((document) => document !== null);
      await this.documentIndex.indexMany(documents);
      indexed += documents.length;
    }
    return { indexed, skipped: candidates.length - indexed };
  }
}
