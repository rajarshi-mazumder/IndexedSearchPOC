import { Client } from "@opensearch-project/opensearch";
import { OpenSearchConfig } from "../infrastructure/config/opensearchConfig";
import { SearchCandidatesUseCase } from "../dataSearch/application/useCases/searchCandidatesUseCase";
import { CandidateSearchRepository } from "../dataSearch/application/ports/candidateSearchRepository";
import { CandidateOpenSearchSearchRepository } from "../dataSearch/infrastructure/repositories/candidateOpenSearchSearchRepository";
import { CandidateLexicalQueryMapper } from "../dataSearch/infrastructure/lexicalSearch/candidateLexicalQueryMapper";
import { CandidateVectorQueryMapper } from "../dataSearch/infrastructure/vectorSearch/candidateVectorQueryMapper";
import { CandidateIndependentSearchRequestMapper } from "../dataSearch/infrastructure/mappers/candidateIndependentSearchRequestMapper";
import { CandidateSearchResponseMapper } from "../dataSearch/infrastructure/mappers/candidateSearchResponseMapper";
import { RankCandidatesByReciprocalRankService } from "../dataSearch/application/services/rankCandidatesByReciprocalRankService";

export function createCandidateSearchRepository(client: Client, config: OpenSearchConfig): CandidateSearchRepository {
  const lexicalQuery = new CandidateLexicalQueryMapper();
  const vectorQuery = new CandidateVectorQueryMapper(config);
  const requests = new CandidateIndependentSearchRequestMapper(config, lexicalQuery, vectorQuery);
  const responses = new CandidateSearchResponseMapper();
  return new CandidateOpenSearchSearchRepository(client, requests, responses);
}

export function createCandidateSearchUseCase(client: Client, config: OpenSearchConfig): SearchCandidatesUseCase {
  const repository = createCandidateSearchRepository(client, config);
  return new SearchCandidatesUseCase(repository, new RankCandidatesByReciprocalRankService());
}
