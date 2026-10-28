import { Client } from "@opensearch-project/opensearch";
import { CandidateReadRepository } from "../candidateData/ports/candidateReadRepository";
import { OpenSearchIndexConfig, OpenSearchSetupConfig } from "../infrastructure/config/opensearchConfig";
import { PrepareCandidateOpenSearchDocumentService } from "../dataEmbedding/indexing/application/services/prepareCandidateOpenSearchDocumentService";
import { FormatCandidateCvTextService } from "../dataEmbedding/indexing/application/services/formatCandidateCvTextService";
import { FormatCandidateProfessionalDetailsService } from "../dataEmbedding/indexing/application/services/formatCandidateProfessionalDetailsService";
import { GenerateCandidateDisplayProfileService } from "../dataEmbedding/indexing/application/services/generateCandidateDisplayProfileService";
import { GenerateCandidateSearchTextService } from "../dataEmbedding/indexing/application/services/generateCandidateSearchTextService";
import { EmbedCandidatesIntoOpenSearchUseCase } from "../dataEmbedding/indexing/application/useCases/embedCandidatesIntoOpenSearchUseCase";
import { CandidateOpenSearchDocumentRepository } from "../dataEmbedding/indexing/infrastructure/repositories/candidateOpenSearchDocumentRepository";
import { SetupCandidateOpenSearchResourcesUseCase } from "../dataEmbedding/setup/application/useCases/setupCandidateOpenSearchResourcesUseCase";
import { CandidateOpenSearchSetupRepository } from "../dataEmbedding/setup/infrastructure/repositories/candidateOpenSearchSetupRepository";
import { CandidateEmbeddingModelRepository } from "../dataEmbedding/setup/infrastructure/repositories/candidateEmbeddingModelRepository";
import { CandidateEmbeddingModelRequestMapper } from "../dataEmbedding/setup/infrastructure/mappers/candidateEmbeddingModelRequestMapper";
import { CandidateOpenSearchSetupRequestMapper } from "../dataEmbedding/setup/infrastructure/mappers/candidateOpenSearchSetupRequestMapper";
import searchPipeline from "../dataSearch/infrastructure/config/candidateHybridSearchPipeline.json";

export function createCandidateDocumentPreparation(): PrepareCandidateOpenSearchDocumentService {
  const professionalDetails = new FormatCandidateProfessionalDetailsService();
  const cvText = new FormatCandidateCvTextService();
  const displayProfile = new GenerateCandidateDisplayProfileService(professionalDetails, cvText);
  const searchText = new GenerateCandidateSearchTextService(professionalDetails, cvText);
  return new PrepareCandidateOpenSearchDocumentService(displayProfile, searchText);
}

export function createCandidateIndexingUseCase(
  candidates: CandidateReadRepository,
  client: Client,
  config: OpenSearchIndexConfig,
): EmbedCandidatesIntoOpenSearchUseCase {
  const documents = new CandidateOpenSearchDocumentRepository(client, config);
  const preparation = createCandidateDocumentPreparation();
  const clock = {
    now: (): Date => {
      return new Date();
    },
  };
  return new EmbedCandidatesIntoOpenSearchUseCase(candidates, preparation, documents, clock);
}

export function createCandidateOpenSearchSetupUseCase(client: Client, config: OpenSearchSetupConfig): SetupCandidateOpenSearchResourcesUseCase {
  const modelRequests = new CandidateEmbeddingModelRequestMapper(config);
  const model = new CandidateEmbeddingModelRepository(client, config, modelRequests);
  const setupRequests = new CandidateOpenSearchSetupRequestMapper(config);
  const resources = new CandidateOpenSearchSetupRepository(client, config, setupRequests, searchPipeline);
  return new SetupCandidateOpenSearchResourcesUseCase(resources, model);
}
