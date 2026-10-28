import { Candidate } from "../../../../shared/domain/models/candidate";

export interface DemoCvFileUpdate {
  candidates: Candidate[];
  changed: number;
}

export interface DemoCvUpdateResult {
  changed: number;
  skipped: number;
  completedFiles: number;
  preview: Candidate[];
}
