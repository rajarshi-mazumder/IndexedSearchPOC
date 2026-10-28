import { Candidate } from "../../../../../shared/domain/models/candidate";
import { CandidateReadRepository } from "../../../../candidateData/ports/candidateReadRepository";
import { CandidateDocument } from "../../../../candidateData/models/candidateDocument";
import { CandidateDocumentPreparation } from "../ports/candidateDocumentPreparation";
import { CandidateDocumentIndex } from "../ports/candidateDocumentIndex";
import { CandidateIndexingClock } from "../ports/candidateIndexingClock";
import { CandidateIndexingProgress, CandidateIndexingResult } from "../ports/candidateIndexingProgress";

interface PreparedCandidateBatch {
  documents: CandidateDocument[];
  staleDocumentIds: string[];
}

export class EmbedCandidatesIntoOpenSearchUseCase {
  public constructor(
    private readonly candidates: CandidateReadRepository,
    private readonly documentPreparation: CandidateDocumentPreparation,
    private readonly documentIndex: CandidateDocumentIndex,
    private readonly clock: CandidateIndexingClock,
  ) {}

  public async execute(
    ids?: string[],
    report: (progress: CandidateIndexingProgress) => void = () => {},
    signal?: AbortSignal,
  ): Promise<CandidateIndexingResult> {
    if (ids?.length === 0) {
      return { indexed: 0, skipped: 0 };
    }
    const candidates = await this.loadSelectedCandidates(ids);
    let indexed = 0;
    let deleted = 0;
    report({ processed: 0, total: candidates.length, indexed: 0, skipped: 0 });
    for (let offset = 0; offset < candidates.length; offset += 100) {
      this.checkForStopRequest(signal);
      const batch = this.prepareCandidateBatch(candidates.slice(offset, offset + 100));
      deleted += await this.removeStaleCandidateDocuments(batch.staleDocumentIds);
      await this.documentIndex.indexMany(batch.documents);
      indexed += batch.documents.length;
      this.reportCompletedBatch(report, offset, candidates.length, indexed);
    }
    return this.createIndexingResult(candidates.length, indexed, deleted);
  }

  private async loadSelectedCandidates(ids: string[] | undefined): Promise<Candidate[]> {
    if (ids === undefined) {
      return this.candidates.getAll();
    }
    return this.candidates.getByIds([...new Set(ids)]);
  }

  private checkForStopRequest(signal: AbortSignal | undefined): void {
    if (signal?.aborted) {
      throw new Error("Indexing stopped after the last completed bulk batch. Rerun this file to finish it.");
    }
  }

  private prepareCandidateBatch(candidates: Candidate[]): PreparedCandidateBatch {
    const documents: CandidateDocument[] = [];
    const staleDocumentIds: string[] = [];
    for (const candidate of candidates) {
      const prepared = this.documentPreparation.prepare(candidate);
      if (prepared !== null) {
        documents.push({ ...prepared, indexedAt: this.clock.now() });
      } else if (candidate.enrichment?.cvProfileRemoved) {
        staleDocumentIds.push(candidate.id);
      }
    }
    return { documents, staleDocumentIds };
  }

  private async removeStaleCandidateDocuments(ids: string[]): Promise<number> {
    if (ids.length > 0) {
      await this.documentIndex.removeMany(ids);
    }
    return ids.length;
  }

  private reportCompletedBatch(
    report: (progress: CandidateIndexingProgress) => void,
    offset: number,
    total: number,
    indexed: number,
  ): void {
    const processed = Math.min(offset + 100, total);
    report({ processed, total, indexed, skipped: processed - indexed });
  }

  private createIndexingResult(total: number, indexed: number, deleted: number): CandidateIndexingResult {
    const result: CandidateIndexingResult = { indexed, skipped: total - indexed };
    if (deleted > 0) {
      result.deleted = deleted;
    }
    return result;
  }
}
