import { Client } from "@opensearch-project/opensearch";
import { setTimeout } from "node:timers/promises";
import { CandidateDocument } from "../../domain/entities/candidate-document";
import { CandidateDocumentIndex } from "../../application/ports/candidate-document-index";
import { OpenSearchIndexConfig } from "../config/opensearch-config";
import { OpenSearchCandidateDocumentMapper } from "./open-search-candidate-document-mapper";

export class OpenSearchCandidateDocumentIndex implements CandidateDocumentIndex {
  constructor(
    private readonly client: Client,
    private readonly config: OpenSearchIndexConfig,
    private readonly wait: (milliseconds: number) => Promise<unknown> = setTimeout,
  ) {}

  async indexMany(documents: CandidateDocument[]): Promise<void> {
    for (let offset = 0; offset < documents.length; offset += 100) {
      await this.writeBatch(documents.slice(offset, offset + 100));
    }
  }

  private async writeBatch(documents: CandidateDocument[]): Promise<void> {
    let pending = documents;
    for (let attempt = 0; attempt < 4; attempt++) {
      const body = pending.flatMap((document) => [
        { index: { _index: this.config.OPENSEARCH_INDEX, _id: document.salesforceId } },
        OpenSearchCandidateDocumentMapper.toDocument(document),
      ]);
      const response = await this.client.bulk({
        pipeline: this.config.OPENSEARCH_INGEST_PIPELINE,
        body,
      });
      if (response.body.items.length !== pending.length) {
        throw new Error("OpenSearch returned an incomplete bulk acknowledgement; indexing was not confirmed.");
      }
      const retry: CandidateDocument[] = [];
      const failures: string[] = [];
      response.body.items.forEach((item, position) => {
        const result = item.index;
        if (result && !result.error && result.status >= 200 && result.status < 300) return;
        const status = result?.status ?? 0;
        if ([429, 502, 503, 504].includes(status) && attempt < 3) {
          retry.push(pending[position]);
        } else {
          failures.push(pending[position].salesforceId + " (" + status + "): " +
            (result?.error?.reason ?? "Missing or failed bulk result"));
        }
      });
      if (failures.length) {
        throw new Error("OpenSearch indexing failed for " + failures.join("; ") +
          ". Some other documents may already be indexed; rerunning uses the same IDs.");
      }
      if (!retry.length) return;
      pending = retry;
      await this.wait(1000 * 2 ** attempt);
    }
  }

}
