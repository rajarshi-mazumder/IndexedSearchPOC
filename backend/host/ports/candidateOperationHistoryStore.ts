import { OperationRecord } from "../../../shared/candidateConsoleContracts";
export interface CandidateOperationHistoryStore {
  read(): Promise<OperationRecord[]>;
  write(operations: OperationRecord[]): Promise<void>;
}
