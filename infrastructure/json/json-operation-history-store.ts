import { z } from "zod";
import { CandidateOperationHistoryStore } from "../../application/ports/candidate-operation-history-store";
import { operationRequestSchema } from "../../application/services/candidate-console-validation";
import { OperationRecord } from "../../shared/candidate-console-contracts";
import { AtomicJsonFileStore } from "./atomic-json-file-store";
import { candidateSchema } from "./candidate-snapshot-serializer";
const recordSchema = z.object({ id: z.string(), kind: z.enum(["fetch", "embed", "setup", "search"]),
  status: z.enum(["running", "stopping", "succeeded", "failed", "cancelled", "interrupted"]),
  profileName: z.string(), index: z.string(), dataset: z.string(), error: z.string().optional(), finishedAt: z.string().optional(),
  request: operationRequestSchema, startedAt: z.string(), events: z.array(z.object({ at: z.string(), message: z.string() })).max(150),
  progress: z.object({ message: z.string(), processed: z.number().optional(), total: z.number().optional(), indexed: z.number().optional(),
    skipped: z.number().optional(), fetched: z.number().optional(), batchNumber: z.number().optional(), file: z.string().optional(),
    fileNumber: z.number().optional(), fileTotal: z.number().optional() }),
  result: z.object({ modelId: z.string().optional(), fetched: z.number().optional(), batchNumber: z.number().optional(), complete: z.boolean().optional(),
    files: z.array(z.object({ file: z.string(), indexed: z.number(), skipped: z.number(), hash: z.string(), size: z.number(), modifiedAt: z.string() })).max(1000).optional(),
    candidates: z.array(z.object({ rank: z.number(), score: z.number(), candidate: candidateSchema, profile: z.string() })).max(100).optional(),
  }).optional(),
});
export class JsonOperationHistoryStore implements CandidateOperationHistoryStore {
  constructor(private readonly file: AtomicJsonFileStore) {}
  async read(): Promise<OperationRecord[]> { return recordSchema.array().max(100).parse(await this.file.read([])); }
  write(operations: OperationRecord[]): Promise<void> { return this.file.write(operations.slice(0, 100)); }
}
