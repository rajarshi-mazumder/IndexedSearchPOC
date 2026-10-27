import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { CandidateOperationService } from "../../application/services/candidate-operation-service";
import { CandidateConsoleSettingsService } from "../../application/services/candidate-console-settings-service";
import { CandidateDatasetService } from "../../application/services/candidate-dataset-service";
import { JsonConsoleSettingsStore } from "../../infrastructure/json/json-console-settings-store";
import { JsonOperationHistoryStore } from "../../infrastructure/json/json-operation-history-store";
import { AtomicJsonFileStore } from "../../infrastructure/json/atomic-json-file-store";
import { LocalCandidateBatchCatalog } from "../../infrastructure/json/local-candidate-batch-catalog";
import { NodeCandidateOperationRunner } from "../../infrastructure/process/node-candidate-operation-runner";
import { CandidateConsoleServer } from "../../presentation/http/candidate-console-server";
import { consoleConfiguration } from "../console-fixtures";
async function main() {
  const directory = await mkdtemp(join(tmpdir(), "candidate-console-browser-"));
  const operations = new CandidateOperationService(new NodeCandidateOperationRunner(resolve("tests/ui/offline-console-worker.ts"), directory),
    new JsonOperationHistoryStore(new AtomicJsonFileStore(join(directory, "operations.json"))));
  await operations.initialize();
  const settings = new CandidateConsoleSettingsService(new JsonConsoleSettingsStore(new AtomicJsonFileStore(join(directory, "settings.json"))), consoleConfiguration);
  const server = new CandidateConsoleServer(settings, operations, new CandidateDatasetService(new LocalCandidateBatchCatalog(join(directory, ".cache/candidates")), operations), resolve("dist/ui"));
  const port = await server.listen(4321); console.log(`Offline browser fixture: http://127.0.0.1:${port}`);
  let closing = false;
  const close = async () => {
    if (closing) return; closing = true; await server.close();
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep) || !directory.includes("candidate-console-browser-")) throw new Error("Invalid test cleanup path");
    await rm(directory, { recursive: true, force: true });
  };
  process.once("SIGINT", () => void close()); process.once("SIGTERM", () => void close());
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
