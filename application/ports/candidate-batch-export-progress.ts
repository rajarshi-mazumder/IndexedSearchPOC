export type CandidateBatchExportProgress =
  | { stage: "fetching"; batchNumber: number; fetched: number; message?: string }
  | { stage: "saved"; batchNumber: number; fetched: number; count: number; file: string };
