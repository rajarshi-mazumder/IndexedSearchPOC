import { z } from "zod";
import { ConsoleConfiguration, OperationRequest } from "../../../shared/candidateConsoleContracts";

export const datasetNameSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/);
export const batchFileNameSchema = z.string().regex(/^batch-\d{6,}\.json$/);
const text = z.string().trim().max(500);
export const consoleConfigurationSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/), name: z.string().trim().min(1).max(80),
  sfOrg: text, awsProfile: text, awsRegion: text, endpoint: text,
  modelId: text, roleArn: text, index: text, automaticPipelines: z.boolean(),
  ingestPipeline: text, searchPipeline: text, dataset: datasetNameSchema,
  sfRecordTypes: z.string().trim().max(1000).optional(), sfTagTypes: z.string().trim().max(10000).optional(),
}).strict();
export const operationRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("enrich"), configuration: consoleConfigurationSchema,
    action: z.enum(["preview", "add", "regenerate", "remove"]), seed: z.string().trim().min(1).max(100),
    files: z.array(batchFileNameSchema).min(1).max(1000).refine((files) => new Set(files).size === files.length, "Select each file once") }).strict(),
  z.object({ kind: z.literal("fetch"), configuration: consoleConfigurationSchema,
    batchSize: z.number().int().min(1).max(1000), maxBatches: z.number().int().min(1).max(10000), resume: z.boolean() }).strict(),
  z.object({ kind: z.literal("setup"), configuration: consoleConfigurationSchema }).strict(),
  z.object({ kind: z.literal("embed"), configuration: consoleConfigurationSchema,
    files: z.array(batchFileNameSchema).min(1).max(1000).refine((files) => new Set(files).size === files.length, "Select each file once") }).strict(),
  z.object({ kind: z.literal("search"), configuration: consoleConfigurationSchema,
    query: z.string().trim().min(1).max(10000), limit: z.number().int().min(1).max(100) }).strict(),
]);

export class CandidateConsoleValidation {
  static configuration(value: unknown): ConsoleConfiguration { return consoleConfigurationSchema.parse(value); }
  static operation(value: unknown): OperationRequest { return operationRequestSchema.parse(value); }
}
