import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { CandidateOperationService } from "../../backend/host/services/candidateOperationService";
import { CandidateConsoleSettingsService } from "../../backend/host/services/candidateConsoleSettingsService";
import { CandidateDatasetService } from "../../backend/host/services/candidateDatasetService";
import { JsonConsoleSettingsStore } from "../../backend/host/repositories/jsonConsoleSettingsStore";
import { JsonOperationHistoryStore } from "../../backend/host/repositories/jsonOperationHistoryStore";
import { AtomicJsonFileStore } from "../../backend/candidateData/repositories/atomicJsonFileStore";
import { LocalCandidateBatchCatalog } from "../../backend/candidateData/repositories/localCandidateBatchCatalog";
import { NodeCandidateOperationRunner } from "../../backend/host/process/nodeCandidateOperationRunner";
import { CandidateConsoleServer } from "../../backend/host/http/candidateConsoleServer";
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
