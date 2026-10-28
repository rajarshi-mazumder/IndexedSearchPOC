import { OperationRequest, WorkerEvent } from "../../../shared/candidateConsoleContracts";
export interface CandidateOperationHandle { stop(): void; terminate(): void }
export interface CandidateOperationRunner {
  start(request: OperationRequest, report: (event: WorkerEvent) => void,
    exited: (error?: string) => void): CandidateOperationHandle;
}
