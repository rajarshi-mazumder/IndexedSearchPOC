import "dotenv/config";
import { resolve } from "node:path";
import { z } from "zod";
import { CandidateConsoleSettingsService } from "../../application/services/candidate-console-settings-service";
import { CandidateOperationService } from "../../application/services/candidate-operation-service";
import { CandidateDatasetService } from "../../application/services/candidate-dataset-service";
import { JsonConsoleSettingsStore } from "../../infrastructure/json/json-console-settings-store";
import { JsonOperationHistoryStore } from "../../infrastructure/json/json-operation-history-store";
import { AtomicJsonFileStore } from "../../infrastructure/json/atomic-json-file-store";
import { LocalCandidateBatchCatalog } from "../../infrastructure/json/local-candidate-batch-catalog";
import { NodeCandidateOperationRunner } from "../../infrastructure/process/node-candidate-operation-runner";
import { CandidateConsoleEnvironment } from "../../infrastructure/config/candidate-console-environment";
import { CandidateConsoleServer } from "./candidate-console-server";
import { CandidateConsoleWorkspaceLock } from "../../infrastructure/process/candidate-console-workspace-lock";

async function main() {
  const lock = new CandidateConsoleWorkspaceLock(resolve(".cache/ui/console.lock"));
  await lock.acquire();
  const settings = new CandidateConsoleSettingsService(new JsonConsoleSettingsStore(new AtomicJsonFileStore(resolve(".cache/ui/settings.json"))),
    CandidateConsoleEnvironment.defaults(process.env));
  const operations = new CandidateOperationService(new NodeCandidateOperationRunner(resolve("presentation/worker/candidate-operation-worker.ts"), process.cwd()),
    new JsonOperationHistoryStore(new AtomicJsonFileStore(resolve(".cache/ui/operations.json"))));
  const datasets = new CandidateDatasetService(new LocalCandidateBatchCatalog(resolve(".cache/candidates")), operations);
  const server = new CandidateConsoleServer(settings, operations, datasets, resolve("dist/ui"));
  let port: number;
  try {
    await operations.initialize();
    port = await server.listen(z.coerce.number().int().min(1).max(65535).parse(process.env.CONSOLE_PORT ?? "4310"));
  } catch (error) { await lock.release(); throw error; }
  console.log(`Candidate console: http://127.0.0.1:${port}`);
  let closing = false;
  const close = () => { if (!closing) { closing = true; void server.close().finally(() => lock.release()).catch((error) => { console.error(error.message); process.exitCode = 1; }); } };
  process.once("SIGINT", close); process.once("SIGTERM", close);
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Console startup failed"); process.exitCode = 1; });
