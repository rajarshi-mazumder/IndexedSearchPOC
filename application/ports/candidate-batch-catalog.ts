import { CandidatePreview, DatasetListing } from "../../shared/candidate-console-contracts";
export interface CandidateBatchCatalog {
  datasets(): Promise<string[]>;
  list(dataset: string, page: number, pageSize: number): Promise<DatasetListing>;
  preview(dataset: string, file: string, page: number, pageSize: number): Promise<CandidatePreview>;
}
