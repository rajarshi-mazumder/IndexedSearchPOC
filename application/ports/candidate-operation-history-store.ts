import { OperationRecord } from "../../shared/candidate-console-contracts";
export interface CandidateOperationHistoryStore {
  read(): Promise<OperationRecord[]>;
  write(operations: OperationRecord[]): Promise<void>;
}
