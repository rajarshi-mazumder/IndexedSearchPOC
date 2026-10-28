import { z } from "zod";
import { CandidateOperationHistoryStore } from "../ports/candidateOperationHistoryStore";
import { operationRequestSchema } from "../services/candidateConsoleValidation";
import { OperationRecord } from "../../../shared/candidateConsoleContracts";
import { AtomicJsonFileStore } from "../../candidateData/repositories/atomicJsonFileStore";
import { candidateSchema } from "../../candidateData/repositories/candidateSnapshotSerializer";
const recordSchema = z.object({ id: z.string(), kind: z.enum(["fetch", "embed", "setup", "search", "enrich"]),
  status: z.enum(["running", "stopping", "succeeded", "failed", "cancelled", "interrupted"]),
  profileName: z.string(), index: z.string(), dataset: z.string(), error: z.string().optional(), finishedAt: z.string().optional(),
  request: operationRequestSchema, startedAt: z.string(), events: z.array(z.object({ at: z.string(), message: z.string() })).max(150),
  progress: z.object({ message: z.string(), processed: z.number().optional(), total: z.number().optional(), indexed: z.number().optional(),
    changed: z.number().optional(),
    skipped: z.number().optional(), fetched: z.number().optional(), batchNumber: z.number().optional(), file: z.string().optional(),
    fileNumber: z.number().optional(), fileTotal: z.number().optional() }),
  result: z.object({ modelId: z.string().optional(), fetched: z.number().optional(), batchNumber: z.number().optional(), complete: z.boolean().optional(),
    enrichment: z.object({ changed: z.number(), skipped: z.number(), completedFiles: z.number() }).optional(),
    files: z.array(z.object({ file: z.string(), indexed: z.number(), skipped: z.number(), deleted: z.number().optional(), hash: z.string(), size: z.number(), modifiedAt: z.string() })).max(1000).optional(),
    candidates: z.array(z.object({ rank: z.number(), score: z.number(), candidate: candidateSchema, profile: z.string(),
      rankingMethod: z.literal("rrf").optional(),
      lexicalScore: z.number().finite().nullable().optional(), vectorScore: z.number().finite().nullable().optional(),
      lexicalRank: z.number().int().positive().nullable().optional(), vectorRank: z.number().int().positive().nullable().optional(),
    })).max(100).optional(),
  }).optional(),
});
export class JsonOperationHistoryStore implements CandidateOperationHistoryStore {
  public constructor(private readonly file: AtomicJsonFileStore) {}

  public async read(): Promise<OperationRecord[]> {
    const records = await this.file.read([]);
    return this.validateRecords(records);
  }

  public write(operations: OperationRecord[]): Promise<void> {
    return this.file.write(operations.slice(0, 100));
  }

  private validateRecords(records: unknown): OperationRecord[] {
    return recordSchema.array().max(100).parse(records);
  }
}
