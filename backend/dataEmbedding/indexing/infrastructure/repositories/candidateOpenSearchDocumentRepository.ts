import { API, Client } from "@opensearch-project/opensearch";
import { setTimeout } from "node:timers/promises";
import { CandidateDocument } from "../../../../candidateData/models/candidateDocument";
import { CandidateDocumentIndex } from "../../application/ports/candidateDocumentIndex";
import { OpenSearchIndexConfig } from "../../../../infrastructure/config/opensearchConfig";
import { OpenSearchCandidateDocumentMapper } from "../../../../candidateData/mappers/openSearchCandidateDocumentMapper";
import { CANDIDATE_SCHEMA_VERSION } from "../../../../infrastructure/opensearch/titanEmbeddingConfig";

type BulkResult = API.Bulk_Response["body"]["items"][number];
type BulkItemResult = BulkResult["index"];

export class CandidateOpenSearchDocumentRepository implements CandidateDocumentIndex {
  private enrichedMappingVerified = false;

  public constructor(
    private readonly client: Client,
    private readonly config: OpenSearchIndexConfig,
    private readonly wait: (milliseconds: number) => Promise<unknown> = setTimeout,
  ) {}

  public async indexMany(documents: CandidateDocument[]): Promise<void> {
    await this.verifyEnrichedMappingWhenRequired(documents);
    for (let offset = 0; offset < documents.length; offset += 100) {
      await this.writeBatch(documents.slice(offset, offset + 100));
    }
  }

  public async removeMany(ids: string[]): Promise<void> {
    for (let offset = 0; offset < ids.length; offset += 100) {
      await this.removeBatch(ids.slice(offset, offset + 100));
    }
  }

  private async verifyEnrichedMappingWhenRequired(documents: CandidateDocument[]): Promise<void> {
    if (this.enrichedMappingVerified || !this.containsEnrichedCandidate(documents)) {
      return;
    }
    const response = await this.client.indices.getMapping({ index: this.config.OPENSEARCH_INDEX });
    const mapping = response.body[this.config.OPENSEARCH_INDEX]?.mappings;
    const enrichment = mapping?.properties?.enrichment;
    if (mapping?._meta?.schema_version !== CANDIDATE_SCHEMA_VERSION || !enrichment || !("enabled" in enrichment) || enrichment.enabled !== false) {
      throw new Error("Enriched candidates require a new index created with the current setup-opensearch command. Choose a new --index and set it up before embedding.");
    }
    this.enrichedMappingVerified = true;
  }

  private containsEnrichedCandidate(documents: CandidateDocument[]): boolean {
    for (const document of documents) {
      if (document.candidate.enrichment) {
        return true;
      }
    }
    return false;
  }

  private async writeBatch(documents: CandidateDocument[]): Promise<void> {
    let pending = documents;
    for (let attempt = 0; attempt < 4; attempt++) {
      const body = this.createIndexRequestBody(pending);
      const response = await this.client.bulk({ pipeline: this.config.OPENSEARCH_INGEST_PIPELINE, body });
      this.requireCompleteIndexAcknowledgements(response.body.items, pending.length);
      const retry = this.selectDocumentsForRetry(response.body.items, pending, attempt);
      if (retry.length === 0) {
        return;
      }
      pending = retry;
      await this.waitBeforeRetry(attempt);
    }
  }

  private createIndexRequestBody(documents: CandidateDocument[]): API.Bulk_Request["body"] {
    const body: API.Bulk_Request["body"] = [];
    for (const document of documents) {
      body.push({ index: { _index: this.config.OPENSEARCH_INDEX, _id: document.salesforceId } });
      body.push(OpenSearchCandidateDocumentMapper.toDocument(document));
    }
    return body;
  }

  private requireCompleteIndexAcknowledgements(items: BulkResult[], expected: number): void {
    if (items.length !== expected) {
      throw new Error("OpenSearch returned an incomplete bulk acknowledgement; indexing was not confirmed.");
    }
  }

  private selectDocumentsForRetry(items: BulkResult[], pending: CandidateDocument[], attempt: number): CandidateDocument[] {
    const retry: CandidateDocument[] = [];
    const failures: string[] = [];
    for (let position = 0; position < items.length; position++) {
      const result = items[position].index;
      if (this.isSuccessfulWrite(result)) {
        continue;
      }
      const status = this.readStatus(result);
      if (this.canRetry(status, attempt)) {
        retry.push(pending[position]);
      } else {
        const reason = this.readFailureReason(result, "Missing or failed bulk result");
        failures.push(pending[position].salesforceId + " (" + status + "): " + reason);
      }
    }
    if (failures.length > 0) {
      throw new Error("OpenSearch indexing failed for " + failures.join("; ") +
        ". Some other documents may already be indexed; rerunning uses the same IDs.");
    }
    return retry;
  }

  private async removeBatch(ids: string[]): Promise<void> {
    let pending = ids;
    for (let attempt = 0; attempt < 4; attempt++) {
      const body = this.createDeleteRequestBody(pending);
      const response = await this.client.bulk({ body });
      this.requireCompleteDeletionAcknowledgements(response.body.items, pending.length);
      const retry = this.selectDeletionsForRetry(response.body.items, pending, attempt);
      if (retry.length === 0) {
        break;
      }
      pending = retry;
      await this.waitBeforeRetry(attempt);
    }
  }

  private createDeleteRequestBody(ids: string[]): API.Bulk_Request["body"] {
    const body: API.Bulk_Request["body"] = [];
    for (const id of ids) {
      body.push({ delete: { _index: this.config.OPENSEARCH_INDEX, _id: id } });
    }
    return body;
  }

  private requireCompleteDeletionAcknowledgements(items: BulkResult[], expected: number): void {
    if (items.length !== expected) {
      throw new Error("OpenSearch returned an incomplete deletion acknowledgement; retry the file.");
    }
  }

  private selectDeletionsForRetry(items: BulkResult[], pending: string[], attempt: number): string[] {
    const retry: string[] = [];
    for (let position = 0; position < items.length; position++) {
      const result = items[position].delete;
      if (this.isSuccessfulWrite(result) || result?.status === 404) {
        continue;
      }
      if (result && this.canRetry(result.status, attempt)) {
        retry.push(pending[position]);
      } else {
        const reason = this.readFailureReason(result, "Missing or failed result");
        throw new Error(`Could not remove stale demo CV document ${pending[position]}: ${reason}. Retry the file.`);
      }
    }
    return retry;
  }

  private isSuccessfulWrite(result: BulkItemResult): boolean {
    if (!result) {
      return false;
    }
    return !result.error && result.status >= 200 && result.status < 300;
  }

  private readStatus(result: BulkItemResult): number {
    if (result?.status == null) {
      return 0;
    }
    return result.status;
  }

  private readFailureReason(result: BulkItemResult, fallback: string): string {
    if (result?.error?.reason == null) {
      return fallback;
    }
    return result.error.reason;
  }

  private canRetry(status: number, attempt: number): boolean {
    return [429, 502, 503, 504].includes(status) && attempt < 3;
  }

  private async waitBeforeRetry(attempt: number): Promise<void> {
    await this.wait(1000 * 2 ** attempt);
  }
}
