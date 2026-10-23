import { DocumentIndex } from "../../application/ports/DocumentIndex";
import { CandidateDocument } from "../../domain/entities/CandidateDocument";
import { OpenSearchClient } from "./OpenSearchClient";
import { OpenSearchDocumentMapper } from "./OpenSearchDocumentMapper";
import mapping from "./config/candidate-index.json";
import searchPipeline from "./config/candidate-hybrid-search-pipeline.json";
import { opensearchConfig } from "../config/opensearch";

export class OpenSearchDocumentIndex implements DocumentIndex {
  constructor(private readonly client = new OpenSearchClient()) {}

  async initialize(): Promise<void> {
    try {
      await this.client.connection.transport.request({
        method: "PUT",
        path: `/_search/pipeline/${opensearchConfig.OPENSEARCH_SEARCH_PIPELINE}`,
        body: searchPipeline,
      });
    } catch (error) {
      throw new Error(
        `Unable to create or update OpenSearch search pipeline '${opensearchConfig.OPENSEARCH_SEARCH_PIPELINE}'. ` +
          "The configured cluster must support the score-ranker-processor (OpenSearch 2.19+).",
        { cause: error },
      );
    }

    const exists = await this.client.connection.indices.exists({
      index: opensearchConfig.OPENSEARCH_INDEX,
    });
    if (exists.body) {
      const response = await this.client.connection.indices.getMapping({
        index: opensearchConfig.OPENSEARCH_INDEX,
      });
      const indexMapping = (response.body as any)[opensearchConfig.OPENSEARCH_INDEX]?.mappings;
      const hasExpectedVector =
        indexMapping?.properties?.embedding?.type === "knn_vector" &&
        indexMapping.properties.embedding.dimension === 768;
      if (!hasExpectedVector) {
        throw new Error(
          `OpenSearch index '${opensearchConfig.OPENSEARCH_INDEX}' has an incompatible embedding mapping. ` +
            "Create a new index with the current candidate-index.json mapping and reindex candidates.",
        );
      }
      await this.client.connection.indices.putMapping({
        index: opensearchConfig.OPENSEARCH_INDEX,
        body: (mapping as any).mappings,
      });
      return;
    }

    await this.client.connection.indices.create({
      index: opensearchConfig.OPENSEARCH_INDEX,
      body: mapping as any,
    });
  }

  async index(document: CandidateDocument): Promise<void> {
    await this.client.connection.index({
      index: opensearchConfig.OPENSEARCH_INDEX,
      id: document.salesforceId,
      refresh: true,
      body: OpenSearchDocumentMapper.toDocument(document),
    });
  }

  async indexMany(documents: CandidateDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }
    const batchSize = 500;
    for (let offset = 0; offset < documents.length; offset += batchSize) {
      const batch = documents.slice(offset, offset + batchSize);
      const body: any[] = [];
      for (const document of batch) {
        body.push({
          index: {
            _index: opensearchConfig.OPENSEARCH_INDEX,
            _id: document.salesforceId,
          },
        });
        body.push(OpenSearchDocumentMapper.toDocument(document));
      }
      const response = await this.client.connection.bulk({
        refresh: false,
        body,
      });
      const failures = (response.body as any).items?.filter((item: any) => item.index?.error) ?? [];
      if (failures.length > 0) {
        throw new Error(
          `OpenSearch failed to index ${failures.length} candidate document(s) in batch starting at ${offset}.`,
        );
      }
    }
    await this.client.connection.indices.refresh({ index: opensearchConfig.OPENSEARCH_INDEX });
  }

  async findById(id: string): Promise<CandidateDocument | null> {
    try {
      const response = await this.client.connection.get({
        index: opensearchConfig.OPENSEARCH_INDEX,
        id,
      });
      if (!response.body.found) {
        return null;
      }
      return OpenSearchDocumentMapper.fromDocument(response.body._source);
    } catch {
      return null;
    }
  }
}
