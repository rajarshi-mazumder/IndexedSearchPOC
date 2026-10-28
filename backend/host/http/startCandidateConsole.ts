import "dotenv/config";
import { resolve } from "node:path";
import { z } from "zod";
import { CandidateConsoleSettingsService } from "../services/candidateConsoleSettingsService";
import { CandidateOperationService } from "../services/candidateOperationService";
import { CandidateDatasetService } from "../services/candidateDatasetService";
import { JsonConsoleSettingsStore } from "../repositories/jsonConsoleSettingsStore";
import { JsonOperationHistoryStore } from "../repositories/jsonOperationHistoryStore";
import { AtomicJsonFileStore } from "../../candidateData/repositories/atomicJsonFileStore";
import { LocalCandidateBatchCatalog } from "../../candidateData/repositories/localCandidateBatchCatalog";
import { NodeCandidateOperationRunner } from "../process/nodeCandidateOperationRunner";
import { CandidateConsoleEnvironment } from "../config/candidateConsoleEnvironment";
import { CandidateConsoleServer } from "./candidateConsoleServer";
import { CandidateConsoleWorkspaceLock } from "../process/candidateConsoleWorkspaceLock";

async function main() {
  const lock = new CandidateConsoleWorkspaceLock(resolve(".cache/ui/console.lock"));
  await lock.acquire();
  const settings = new CandidateConsoleSettingsService(new JsonConsoleSettingsStore(new AtomicJsonFileStore(resolve(".cache/ui/settings.json"))),
    CandidateConsoleEnvironment.defaults(process.env));
  const operations = new CandidateOperationService(new NodeCandidateOperationRunner(resolve("backend/host/worker/candidateOperationWorker.ts"), process.cwd()),
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
