import "dotenv/config";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { CandidateReadRepository } from "./application/ports/candidate-read-repository";
import { DummyCandidateRepository } from "./infrastructure/dummy/dummy-candidate-repository";
import { DUMMY_CANDIDATES } from "./infrastructure/dummy/dummy-candidates";
import { IndexCandidates } from "./application/usecases/index-candidates";
import { SearchCandidates } from "./application/usecases/search-candidates";
import { CandidateDocumentFactory } from "./application/services/candidate-document-factory";
import { TemplateCandidateProfileGenerator } from "./application/services/template-candidate-profile-generator";
import { loadOpenSearchConfig, loadOpenSearchSetupConfig } from "./infrastructure/config/opensearch-config";
import { loadSalesforceConfig } from "./infrastructure/config/salesforce-config";
import { OpenSearchServerlessClient } from "./infrastructure/opensearch/open-search-serverless-client";
import { OpenSearchCandidateDocumentIndex } from "./infrastructure/opensearch/open-search-candidate-document-index";
import { OpenSearchHybridSearch } from "./infrastructure/opensearch/open-search-hybrid-search";
import { OpenSearchBedrockModel } from "./infrastructure/opensearch/open-search-bedrock-model";
import { OpenSearchCandidateSetup } from "./infrastructure/opensearch/open-search-candidate-setup";
import { SalesforceCandidateRepository } from "./infrastructure/salesforce/salesforce-candidate-repository";
import { SalesforceQueryClient } from "./infrastructure/salesforce/salesforce-query-client";
import { SalesforceCliAuthentication } from "./infrastructure/salesforce/salesforce-cli-authentication";
import { SalesforceCliCommand } from "./infrastructure/salesforce/salesforce-cli-command";

export function createIndexingContext() {
  const sfConfig = loadSalesforceConfig(process.env);
  const cli = new SalesforceCliCommand();
  const auth = new SalesforceCliAuthentication(sfConfig.SF_TARGET_ORG, (args) => cli.execute(args));
  const repository = new SalesforceCandidateRepository(new SalesforceQueryClient(auth.createConnection()));
  return createCandidateIndexingContext(repository);
}

export function createDemoIndexingContext() {
  return createCandidateIndexingContext(new DummyCandidateRepository(DUMMY_CANDIDATES));
}

function createCandidateIndexingContext(repository: CandidateReadRepository) {
  const config = loadOpenSearchConfig(process.env);
  const client = new OpenSearchServerlessClient(config, defaultProvider()).connection;
  const documentIndex = new OpenSearchCandidateDocumentIndex(client, config);
  const factory = new CandidateDocumentFactory(new TemplateCandidateProfileGenerator());
  return {
    indexCandidates: new IndexCandidates(repository, factory, documentIndex),
    close: () => client.close(),
  };
}

export function createSearchContext() {
  const config = loadOpenSearchConfig(process.env);
  const client = new OpenSearchServerlessClient(config, defaultProvider()).connection;
  return {
    searchCandidates: new SearchCandidates(new OpenSearchHybridSearch(client, config)),
    close: () => client.close(),
  };
}

export function createSetupContext() {
  const config = loadOpenSearchSetupConfig(process.env);
  const client = new OpenSearchServerlessClient(config, defaultProvider()).connection;
  const model = new OpenSearchBedrockModel(client, config);
  return {
    setup: new OpenSearchCandidateSetup(client, config, model),
    close: () => client.close(),
  };
}
