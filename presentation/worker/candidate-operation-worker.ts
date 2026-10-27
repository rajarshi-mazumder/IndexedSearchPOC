import { createCandidateConsoleOperationExecutor } from "../../bootstrap";
import { CandidateConsoleValidation } from "../../application/services/candidate-console-validation";
import { WorkerEvent } from "../../shared/candidate-console-contracts";

const controller = new AbortController();
let started = false;
function send(event: WorkerEvent): void { if (process.connected) process.send?.(event); }
process.on("disconnect", () => { controller.abort(); });
process.on("message", (message: { type: string; request?: unknown }) => {
  if (message.type === "stop") { controller.abort(); return; }
  if (message.type !== "start" || started) return;
  started = true;
  void Promise.resolve().then(() => {
    const request = CandidateConsoleValidation.operation(message.request);
    return createCandidateConsoleOperationExecutor(request, process.cwd()).execute(request, send, controller.signal);
  })
    .then((result) => send({ type: "result", result, cancelled: controller.signal.aborted }))
    .catch((error) => {
      if (controller.signal.aborted) send({ type: "result", result: {}, cancelled: true });
      else send({ type: "error", message: error instanceof Error ? error.message.slice(0, 4000) : "Operation failed" });
    })
    .finally(() => { if (process.connected) process.disconnect(); });
});
