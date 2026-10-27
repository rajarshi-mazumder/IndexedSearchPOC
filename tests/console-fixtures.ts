import { CandidateOperationHandle, CandidateOperationRunner } from "../application/ports/candidate-operation-runner";
import { CandidateOperationHistoryStore } from "../application/ports/candidate-operation-history-store";
import { ConsoleConfiguration, OperationRecord, OperationRequest, WorkerEvent } from "../shared/candidate-console-contracts";
export const consoleConfiguration: ConsoleConfiguration = {
  id: "test", name: "Full sandbox", sfOrg: "full", awsProfile: "default", awsRegion: "ap-northeast-1",
  endpoint: "https://offline.ap-northeast-1.aoss.amazonaws.com", modelId: "offline-model",
  roleArn: "arn:aws:iam::123456789012:role/TestBedrockRole", index: "candidates-fsb", automaticPipelines: true,
  ingestPipeline: "", searchPipeline: "", dataset: "fsb",
};
export class MemoryOperationHistoryStore implements CandidateOperationHistoryStore {
  records: OperationRecord[] = [];
  async read() { return structuredClone(this.records); }
  async write(records: OperationRecord[]) { this.records = structuredClone(records); }
}
export class ControlledCandidateOperationRunner implements CandidateOperationRunner {
  calls: { request: OperationRequest; report: (event: WorkerEvent) => void; exited: (error?: string) => void; stopped: boolean; terminated: boolean }[] = [];
  start(request: OperationRequest, report: (event: WorkerEvent) => void, exited: (error?: string) => void): CandidateOperationHandle {
    const call = { request, report, exited, stopped: false, terminated: false }; this.calls.push(call);
    return { stop: () => { call.stopped = true; }, terminate: () => { call.terminated = true; } };
  }
}
