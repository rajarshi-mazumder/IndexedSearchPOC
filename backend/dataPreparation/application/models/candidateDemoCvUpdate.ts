export type CandidateCvAction = "preview" | "add" | "regenerate" | "remove";

export interface CandidateCvProgress {
  message: string;
  file: string;
  fileNumber: number;
  fileTotal: number;
  processed: number;
  total: number;
  changed: number;
  skipped: number;
}
