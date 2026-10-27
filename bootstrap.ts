import "dotenv/config";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { CandidateReadRepository } from "./application/ports/candidate-read-repository";
import { DummyCandidateRepository } from "./infrastructure/dummy/dummy-candidate-repository";
import { DUMMY_CANDIDATES } from "./infrastructure/dummy/dummy-candidates";
import { IndexCandidates } from "./application/usecases/index-candidates";
import { ExportCandidateSnapshot } from "./application/usecases/export-candidate-snapshot";
import { ExportCandidateBatches } from "./application/usecases/export-candidate-batches";
import { JsonCandidateBatchExportStore } from "./infrastructure/json/json-candidate-batch-export-store";
import { SnapshottingCandidateRepository } from "./application/services/snapshotting-candidate-repository";
import { JsonCandidateSnapshotStore } from "./infrastructure/json/json-candidate-snapshot-store";
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

export const DEFAULT_CANDIDATE_SNAPSHOT_FILE = ".cache/candidates/salesforce-candidates.json";

function createSalesforceSnapshotRepository(snapshotFile: string, environment: NodeJS.ProcessEnv) {
  const sfConfig = loadSalesforceConfig(environment);
  const cli = new SalesforceCliCommand();
  const auth = new SalesforceCliAuthentication(sfConfig.SF_TARGET_ORG, (args) => cli.execute(args));
  const repository = new SalesforceCandidateRepository(new SalesforceQueryClient(auth.createConnection()));
  return new SnapshottingCandidateRepository(repository, new JsonCandidateSnapshotStore(snapshotFile));
}

export function createIndexingContext(snapshotFile = DEFAULT_CANDIDATE_SNAPSHOT_FILE, environment = process.env) {
  return createCandidateIndexingContext(createSalesforceSnapshotRepository(snapshotFile, environment), environment);
}

export function createJsonIndexingContext(snapshotFile = DEFAULT_CANDIDATE_SNAPSHOT_FILE, environment = process.env) {
  return createCandidateIndexingContext(new JsonCandidateSnapshotStore(snapshotFile), environment);
}

export function createCandidateSnapshotExportContext(snapshotFile = DEFAULT_CANDIDATE_SNAPSHOT_FILE, environment = process.env) {
  return { exportCandidateSnapshot: new ExportCandidateSnapshot(createSalesforceSnapshotRepository(snapshotFile, environment)) };
}

export function createCandidateBatchExportContext(directory: string, environment = process.env) {
  const sfConfig = loadSalesforceConfig(environment);
  const cli = new SalesforceCliCommand();
  const session = new SalesforceCliAuthentication(sfConfig.SF_TARGET_ORG, (args) => cli.execute(args)).createSession();
  const repository = new SalesforceCandidateRepository(new SalesforceQueryClient(session.connection));
  return { sourceId: session.sourceId,
    exportCandidateBatches: new ExportCandidateBatches(repository, new JsonCandidateBatchExportStore(directory)) };
}

export function createDemoIndexingContext(environment = process.env) {
  return createCandidateIndexingContext(new DummyCandidateRepository(DUMMY_CANDIDATES), environment);
}

function createCandidateIndexingContext(repository: CandidateReadRepository, environment: NodeJS.ProcessEnv) {
  const config = loadOpenSearchConfig(environment);
  const client = new OpenSearchServerlessClient(config, defaultProvider()).connection;
  const documentIndex = new OpenSearchCandidateDocumentIndex(client, config);
  const factory = new CandidateDocumentFactory(new TemplateCandidateProfileGenerator());
  return {
    indexCandidates: new IndexCandidates(repository, factory, documentIndex),
    index: config.OPENSEARCH_INDEX,
    close: () => client.close(),
  };
}

export function createSearchContext(environment = process.env) {
  const config = loadOpenSearchConfig(environment);
  const client = new OpenSearchServerlessClient(config, defaultProvider()).connection;
  return {
    searchCandidates: new SearchCandidates(new OpenSearchHybridSearch(client, config)),
    index: config.OPENSEARCH_INDEX,
    close: () => client.close(),
  };
}

export function createSetupContext(environment = process.env) {
  const config = loadOpenSearchSetupConfig(environment);
  const client = new OpenSearchServerlessClient(config, defaultProvider()).connection;
  const model = new OpenSearchBedrockModel(client, config);
  return {
    setup: new OpenSearchCandidateSetup(client, config, model),
    index: config.OPENSEARCH_INDEX,
    close: () => client.close(),
  };
}
