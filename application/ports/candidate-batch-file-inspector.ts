export interface CandidateBatchFileInspector {
  validate(file: string): Promise<void>;
  fingerprint(file: string): Promise<{ hash: string; size: number; modifiedAt: string }>;
}
