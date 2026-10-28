// The only contract-test file that knows production source paths. During a move,
// update these bindings, never the scenario inputs or golden outputs.
export { CandidateOperationService } from "../../backend/host/services/candidateOperationService";
export { CandidateConsoleSettingsService } from "../../backend/host/services/candidateConsoleSettingsService";
export { CandidateDatasetService } from "../../backend/host/services/candidateDatasetService";
export { JsonConsoleSettingsStore } from "../../backend/host/repositories/jsonConsoleSettingsStore";
export { JsonOperationHistoryStore } from "../../backend/host/repositories/jsonOperationHistoryStore";
export { AtomicJsonFileStore } from "../../backend/candidateData/repositories/atomicJsonFileStore";
export { LocalCandidateBatchCatalog } from "../../backend/candidateData/repositories/localCandidateBatchCatalog";
export { NodeCandidateOperationRunner } from "../../backend/host/process/nodeCandidateOperationRunner";
export { CandidateConsoleServer } from "../../backend/host/http/candidateConsoleServer";
export { SalesforceCliCommand } from "../../backend/dataPreparation/infrastructure/repositories/salesforceCliCommand";

export const openSearchClientModule = require.resolve("../../backend/infrastructure/opensearch/openSearchServerlessClient");
export const operationWorkerModule = require.resolve("../../backend/host/worker/candidateOperationWorker");
export const indexingCliModule = require.resolve("../../backend/host/cli/indexCandidates");
export const searchCliModule = require.resolve("../../backend/host/cli/search");
