import { Client } from "@opensearch-project/opensearch";
import { OpenSearchSetupConfig } from "../../backend/infrastructure/config/opensearchConfig";
import { CandidateEmbeddingModelRepository } from "../../backend/dataEmbedding/setup/infrastructure/repositories/candidateEmbeddingModelRepository";
import { CandidateEmbeddingModelRequestMapper } from "../../backend/dataEmbedding/setup/infrastructure/mappers/candidateEmbeddingModelRequestMapper";

/** Injects the pure request mapper while retaining the existing test constructor. */
export class EnsureCandidateEmbeddingModelTestDriver extends CandidateEmbeddingModelRepository {
  public constructor(client: Client, config: OpenSearchSetupConfig) {
    super(client, config, new CandidateEmbeddingModelRequestMapper(config));
  }
}
