import { dirname, join } from "node:path";
import { LocalCandidateDatasetLock } from "../candidateData/repositories/localCandidateDatasetLock";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { CandidateReadRepository } from "../candidateData/ports/candidateReadRepository";
import { DummyCandidateRepository } from "../dataPreparation/infrastructure/repositories/dummyCandidateRepository";
import { DUMMY_CANDIDATES } from "../dataPreparation/infrastructure/fixtures/dummyCandidates";
import { EmbedCandidatesIntoOpenSearchUseCase } from "../dataEmbedding/indexing/application/useCases/embedCandidatesIntoOpenSearchUseCase";
import { createCandidateIndexingUseCase, createCandidateOpenSearchSetupUseCase } from "./createCandidateEmbedding";
import { JsonCandidateSnapshotStore } from "../candidateData/repositories/jsonCandidateSnapshotStore";
import { createCandidateSearchUseCase } from "./createCandidateSearch";
import { loadOpenSearchConfig, loadOpenSearchSetupConfig } from "../infrastructure/config/opensearchConfig";
import { OpenSearchServerlessClient } from "../infrastructure/opensearch/openSearchServerlessClient";
import { CandidateConsoleOperationExecutor } from "../host/services/candidateConsoleOperationExecutor";
import { LocalCandidateBatchCatalog } from "../candidateData/repositories/localCandidateBatchCatalog";
import { CandidateConsoleEnvironment } from "../host/config/candidateConsoleEnvironment";
import { OperationRequest } from "../../shared/candidateConsoleContracts";

import { createSalesforceSnapshotRepository, createCandidateBatchExportContext, createCandidateDemoCvUpdateContext,
  DEFAULT_CANDIDATE_SNAPSHOT_FILE } from "./createCandidatePreparation";
export { createCandidateBatchExportContext, createCandidateSnapshotExportContext, DEFAULT_CANDIDATE_SNAPSHOT_FILE } from "./createCandidatePreparation";

export function createIndexingContext(snapshotFile = DEFAULT_CANDIDATE_SNAPSHOT_FILE, environment = process.env) {
  return createCandidateIndexingContext(createSalesforceSnapshotRepository(snapshotFile, environment), environment);
}

export function createJsonIndexingContext(snapshotFile = DEFAULT_CANDIDATE_SNAPSHOT_FILE, environment = process.env) {
  const context = createCandidateIndexingContext(new JsonCandidateSnapshotStore(snapshotFile), environment);
  const lock = new LocalCandidateDatasetLock(dirname(snapshotFile));
  return { ...context, indexCandidates: {
    execute: (...args: Parameters<EmbedCandidatesIntoOpenSearchUseCase["execute"]>) => lock.withLock(() => context.indexCandidates.execute(...args)),
  } };
}

export function createDemoIndexingContext(environment = process.env) {
  return createCandidateIndexingContext(new DummyCandidateRepository(DUMMY_CANDIDATES), environment);
}

function createCandidateIndexingContext(repository: CandidateReadRepository, environment: NodeJS.ProcessEnv) {
  const config = loadOpenSearchConfig(environment);
  const client = new OpenSearchServerlessClient(config, defaultProvider()).connection;
  return {
    indexCandidates: createCandidateIndexingUseCase(repository, client, config),
    index: config.OPENSEARCH_INDEX,
    close: () => client.close(),
  };
}

export function createSearchContext(environment = process.env) {
  const config = loadOpenSearchConfig(environment);
  const client = new OpenSearchServerlessClient(config, defaultProvider()).connection;
  return {
    searchCandidates: createCandidateSearchUseCase(client, config),
    index: config.OPENSEARCH_INDEX,
    close: () => client.close(),
  };
}

export function createSetupContext(environment = process.env) {
  const config = loadOpenSearchSetupConfig(environment);
  const client = new OpenSearchServerlessClient(config, defaultProvider()).connection;
  return {
    setup: createCandidateOpenSearchSetupUseCase(client, config),
    index: config.OPENSEARCH_INDEX,
    close: () => client.close(),
  };
}

export function createCandidateConsoleOperationExecutor(request: OperationRequest, workspace: string, baseEnvironment = process.env) {
  const environment = CandidateConsoleEnvironment.validate(request, baseEnvironment);
  const catalog = new LocalCandidateBatchCatalog(join(workspace, ".cache/candidates"));
  const dataset = request.configuration.dataset;
  return new CandidateConsoleOperationExecutor({
    enrich: (enrich, report, signal) => {
      const { updateCandidateDemoCvFiles } = createCandidateDemoCvUpdateContext(join(workspace, ".cache/candidates", dataset));
      return updateCandidateDemoCvFiles.execute(enrich.files, enrich.action, enrich.seed, report, signal);
    },
    fetch: async (fetch, report, signal) => {
      const context = createCandidateBatchExportContext(await catalog.datasetPath(dataset, true), environment);
      return context.fetchCandidateBatches.execute({ org: environment.SF_TARGET_ORG!, sourceId: context.sourceId,
        batchSize: fetch.batchSize, maxBatches: fetch.maxBatches, resume: fetch.resume }, report, signal);
    },
    setup: async () => {
      const context = createSetupContext(environment);
      try { return await context.setup.execute(); } finally { await context.close(); }
    },
    search: async (query, limit) => {
      const context = createSearchContext(environment);
      try { return await context.searchCandidates.execute(query, limit); } finally { await context.close(); }
    },
    index: async (file, report, signal) => {
      const context = createJsonIndexingContext(await catalog.filePath(dataset, file), environment);
      try { return await context.indexCandidates.execute(undefined, report, signal); } finally { await context.close(); }
    },
  }, {
    validate: async (file) => { await catalog.assertCommitted(dataset, file); await catalog.preview(dataset, file, 1, 1); },
    fingerprint: (file) => catalog.fingerprint(dataset, file),
  });
}
