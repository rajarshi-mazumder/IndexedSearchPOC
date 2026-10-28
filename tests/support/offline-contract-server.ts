import { join, resolve } from "node:path";
import {
  CandidateOperationService, CandidateConsoleSettingsService, CandidateDatasetService,
  JsonConsoleSettingsStore, JsonOperationHistoryStore, AtomicJsonFileStore,
  LocalCandidateBatchCatalog, NodeCandidateOperationRunner, CandidateConsoleServer,
} from "./current-backend-bindings";
import configuration from "../e2e/fixtures/input/configuration.json";

async function main() {
  const workspace = process.cwd();
  const operations = new CandidateOperationService(
    new NodeCandidateOperationRunner(resolve(__dirname, "offline-contract-worker.ts"), workspace),
    new JsonOperationHistoryStore(new AtomicJsonFileStore(join(workspace, "operations.json"))));
  await operations.initialize();
  const settings = new CandidateConsoleSettingsService(new JsonConsoleSettingsStore(new AtomicJsonFileStore(join(workspace, "settings.json"))), configuration);
  const server = new CandidateConsoleServer(settings, operations,
    new CandidateDatasetService(new LocalCandidateBatchCatalog(join(workspace, ".cache/candidates")), operations), workspace);
  const port = await server.listen(0);
  process.send?.({ port });
  process.once("message", () => { void server.close().then(() => process.disconnect?.()); });
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
