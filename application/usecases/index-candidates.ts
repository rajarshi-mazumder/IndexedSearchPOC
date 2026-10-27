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
  async execute(ids?: string[], report: (progress: {
    processed: number; total: number; indexed: number; skipped: number;
  }) => void = () => {}, signal?: AbortSignal): Promise<{ indexed: number; skipped: number }> {
    if (ids?.length === 0) return { indexed: 0, skipped: 0 };
    const candidates = ids === undefined
      ? await this.repository.getAll()
      : await this.repository.getByIds([...new Set(ids)]);
    let indexed = 0;
    report({ processed: 0, total: candidates.length, indexed: 0, skipped: 0 });
    // Bound document preparation memory independently of the adapter's bulk limit.
    for (let offset = 0; offset < candidates.length; offset += 100) {
      if (signal?.aborted) throw new Error("Indexing stopped after the last completed bulk batch. Rerun this file to finish it.");
      const documents = candidates.slice(offset, offset + 100)
        .map((candidate) => this.documentFactory.create(candidate))
        .filter((document) => document !== null);
      await this.documentIndex.indexMany(documents);
      indexed += documents.length;
      const processed = Math.min(offset + 100, candidates.length);
      report({ processed, total: candidates.length, indexed, skipped: processed - indexed });
    }
    return { indexed, skipped: candidates.length - indexed };
  }
}
