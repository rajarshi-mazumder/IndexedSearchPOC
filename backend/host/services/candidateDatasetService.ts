import { z } from "zod";
import { CandidateBatchCatalog } from "../../candidateData/ports/candidateBatchCatalog";
import { CandidateEmbeddingHistory } from "../ports/candidateEmbeddingHistory";
import { CandidateConsoleValidation, datasetNameSchema, batchFileNameSchema } from "./candidateConsoleValidation";
import { CandidatePreview, DatasetListing } from "../../../shared/candidateConsoleContracts";
const paginationSchema = z.object({ page: z.number().int().min(1).max(100000), pageSize: z.number().int().min(1).max(100) });
export class CandidateDatasetService {
  constructor(private readonly catalog: CandidateBatchCatalog, private readonly operations: CandidateEmbeddingHistory) {}
  datasets(): Promise<string[]> { return this.catalog.datasets(); }
  async list(input: unknown): Promise<DatasetListing> {
    const request = paginationSchema.extend({ configuration: z.unknown() }).parse(input);
    const configuration = CandidateConsoleValidation.configuration(request.configuration);
    const result = await this.catalog.list(configuration.dataset, request.page, request.pageSize);
    const history = this.operations.embeddingHistory(configuration);
    for (const file of result.files) {
      const previous = history.find((item) => item.file === file.name);
      if (previous) file.lastEmbedding = { at: previous.at, indexed: previous.indexed, skipped: previous.skipped,
        changed: previous.size !== file.size || previous.modifiedAt !== file.modifiedAt };
    }
    return result;
  }
  preview(input: unknown): Promise<CandidatePreview> {
    const request = paginationSchema.extend({ dataset: datasetNameSchema, file: batchFileNameSchema }).strict().parse(input);
    return this.catalog.preview(request.dataset, request.file, request.page, request.pageSize);
  }
}
