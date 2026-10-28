import { basename, dirname } from "node:path";
import { CandidateDemoCvFileRepository } from "../candidateData/repositories/candidateDemoCvFileRepository";
import { CandidateBatchFileRepository } from "../candidateData/repositories/candidateBatchFileRepository";
import { JsonCandidateSnapshotStore } from "../candidateData/repositories/jsonCandidateSnapshotStore";
import { LocalCandidateBatchCatalog } from "../candidateData/repositories/localCandidateBatchCatalog";
import { loadSalesforceConfig } from "../dataPreparation/infrastructure/config/salesforceConfig";
import { SalesforceCandidateRepository } from "../dataPreparation/infrastructure/repositories/salesforceCandidateRepository";
import { SalesforceCandidateSchema } from "../dataPreparation/infrastructure/repositories/salesforceCandidateSchema";
import { SalesforceQueryClient } from "../dataPreparation/infrastructure/repositories/salesforceQueryClient";
import { SalesforceCliAuthentication } from "../dataPreparation/infrastructure/repositories/salesforceCliAuthentication";
import { SalesforceCliCommand } from "../dataPreparation/infrastructure/repositories/salesforceCliCommand";
import { PersistFetchedCandidatesRepository } from "../dataPreparation/infrastructure/repositories/persistFetchedCandidatesRepository";
import { LoadSalesforceCandidateDetailsService } from "../dataPreparation/application/services/loadSalesforceCandidateDetailsService";
import { FetchSalesforceCandidatesIntoBatchFilesUseCase } from "../dataPreparation/application/useCases/fetchSalesforceCandidatesIntoBatchFilesUseCase";
import { UpdateCandidateDemoCvFilesUseCase } from "../dataPreparation/application/useCases/updateCandidateDemoCvFilesUseCase";
import { CandidateQualitySummary } from "../candidateData/services/candidateQualitySummary";
import { FetchSelectedSalesforceCandidatesIntoFileUseCase } from "../dataPreparation/application/useCases/fetchSelectedSalesforceCandidatesIntoFileUseCase";
import { CombineSalesforceCandidateDetailsService } from "../dataPreparation/application/services/combineSalesforceCandidateDetailsService";
import { GenerateDemoCvForCandidateService } from "../dataPreparation/application/services/generateDemoCvForCandidateService";
import { ApplyDemoCvToCandidateService } from "../dataPreparation/application/services/applyDemoCvToCandidateService";
import { PrepareCandidateFetchCheckpointService } from "../dataPreparation/application/services/prepareCandidateFetchCheckpointService";

export const DEFAULT_CANDIDATE_SNAPSHOT_FILE = ".cache/candidates/salesforce-candidates.json";

function createCandidateDetailsSource(client: SalesforceQueryClient, config: ReturnType<typeof loadSalesforceConfig>) {
  return new LoadSalesforceCandidateDetailsService(new SalesforceCandidateRepository(client, new SalesforceCandidateSchema(client), {
    recordTypes: config.SF_CANDIDATE_RECORD_TYPES, tagTypes: config.SF_TAG_TYPE_MAP,
  }), new CombineSalesforceCandidateDetailsService());
}

export function createSalesforceSnapshotRepository(snapshotFile: string, environment: NodeJS.ProcessEnv) {
  const config = loadSalesforceConfig(environment);
  const cli = new SalesforceCliCommand();
  const auth = new SalesforceCliAuthentication(config.SF_TARGET_ORG, (args) => cli.execute(args));
  const source = createCandidateDetailsSource(new SalesforceQueryClient(auth.createConnection()), config);
  return new PersistFetchedCandidatesRepository(source, new JsonCandidateSnapshotStore(snapshotFile));
}

export function createCandidateSnapshotExportContext(snapshotFile = DEFAULT_CANDIDATE_SNAPSHOT_FILE, environment = process.env) {
  return { exportCandidateSnapshot: new FetchSelectedSalesforceCandidatesIntoFileUseCase(createSalesforceSnapshotRepository(snapshotFile, environment)) };
}

function connectSalesforceBatchRepositories(directory: string, environment: NodeJS.ProcessEnv) {
  const config = loadSalesforceConfig(environment);
  const cli = new SalesforceCliCommand();
  const session = new SalesforceCliAuthentication(config.SF_TARGET_ORG, (args) => cli.execute(args)).createSession();
  return { sourceId: session.sourceId,
    source: createCandidateDetailsSource(new SalesforceQueryClient(session.connection), config),
    files: new CandidateBatchFileRepository(directory) };
}

/** Local CV actions need file adapters only; they never authenticate with Salesforce. */
export function createCandidateDemoCvUpdateContext(directory: string) {
  const catalog = new LocalCandidateBatchCatalog(dirname(directory));
  const files = new CandidateDemoCvFileRepository(catalog, basename(directory));
  const transformer = new ApplyDemoCvToCandidateService(new GenerateDemoCvForCandidateService());
  const updateCandidateDemoCvFiles = new UpdateCandidateDemoCvFilesUseCase(files, transformer, {
    allowPendingStopRequest: async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    },
  });
  return { updateCandidateDemoCvFiles };
}

export function createCandidateBatchExportContext(directory: string, environment = process.env) {
  // Preserve authentication before CLI export-directory progress and dataset locking.
  const repositories = connectSalesforceBatchRepositories(directory, environment);
  const fetchCandidateBatches = new FetchSalesforceCandidatesIntoBatchFilesUseCase(
    repositories.source,
    repositories.files,
    new PrepareCandidateFetchCheckpointService(),
    CandidateQualitySummary
  );
  return { sourceId: repositories.sourceId, fetchCandidateBatches };
}
