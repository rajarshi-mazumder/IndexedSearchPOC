import { Client } from "@opensearch-project/opensearch";
import { OpenSearchSetupConfig } from "../../backend/infrastructure/config/opensearchConfig";
import { CandidateEmbeddingModel } from "../../backend/dataEmbedding/setup/application/ports/candidateEmbeddingModel";
import { SetupCandidateOpenSearchResourcesUseCase } from "../../backend/dataEmbedding/setup/application/useCases/setupCandidateOpenSearchResourcesUseCase";
import { CandidateOpenSearchSetupRepository } from "../../backend/dataEmbedding/setup/infrastructure/repositories/candidateOpenSearchSetupRepository";
import { CandidateOpenSearchSetupRequestMapper } from "../../backend/dataEmbedding/setup/infrastructure/mappers/candidateOpenSearchSetupRequestMapper";
import searchPipeline from "../../backend/dataSearch/infrastructure/config/candidateHybridSearchPipeline.json";

/** Wires real infrastructure to the old test constructor without changing assertions. */
export class SetupCandidateOpenSearchResourcesTestDriver extends SetupCandidateOpenSearchResourcesUseCase {
  public constructor(client: Client, config: OpenSearchSetupConfig, model: CandidateEmbeddingModel) {
    const requests = new CandidateOpenSearchSetupRequestMapper(config);
    const resources = new CandidateOpenSearchSetupRepository(client, config, requests, searchPipeline);
    super(resources, model);
  }
}
