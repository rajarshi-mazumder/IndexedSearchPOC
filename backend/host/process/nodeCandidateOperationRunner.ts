import { fork } from "node:child_process";
import { pathToFileURL } from "node:url";
import { CandidateOperationRunner, CandidateOperationHandle } from "../ports/candidateOperationRunner";
import { OperationRequest, WorkerEvent } from "../../../shared/candidateConsoleContracts";
import { CandidateConsoleEnvironment } from "../config/candidateConsoleEnvironment";

export class NodeCandidateOperationRunner implements CandidateOperationRunner {
  constructor(private readonly workerPath: string, private readonly workingDirectory: string) {}
  start(request: OperationRequest, report: (event: WorkerEvent) => void, exited: (error?: string) => void): CandidateOperationHandle {
    const environment = CandidateConsoleEnvironment.validate(request, process.env);
    const child = fork(this.workerPath, [], { cwd: this.workingDirectory, env: environment,
      execArgv: ["--import", pathToFileURL(require.resolve("tsx")).href], stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true });
    let finished = false;
    const finish = (error?: string) => { if (!finished) { finished = true; exited(error); } };
    child.on("message", (event: WorkerEvent) => report(event));
    child.on("error", () => finish("Could not launch or communicate with the operation worker."));
    child.once("exit", (code) => finish(code ? `Operation worker exited with code ${code}.` : undefined));
    child.send({ type: "start", request });
    return {
      stop: () => { if (child.connected) child.send({ type: "stop" }); },
      terminate: () => { if (child.connected) child.send({ type: "stop" }); child.kill(); },
    };
  }
}
