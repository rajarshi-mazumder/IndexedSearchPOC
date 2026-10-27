import { z } from "zod";
import { Candidate } from "../../domain/entities/candidate";
import { candidateEnrichmentSchema } from "./candidate-enrichment-schema";

const optionalText = z.string().nullish().transform((value) => value ?? undefined);
export const candidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: optionalText,
  company: optionalText,
  location: optionalText,
  salary: z.number().finite().nullish().transform((value) => value ?? undefined),
  enrichment: candidateEnrichmentSchema.optional(),
  skills: z.array(z.string()),
  skillCategories: z.array(z.string()),
  systems: z.array(z.string()),
  industries: z.array(z.string()),
  subIndustries: z.array(z.string()),
  jobFunctions: z.array(z.string()),
  languages: z.array(z.object({ code: z.string(), level: z.string() }).strict()),
}).strict();
const candidatesSchema = z.array(candidateSchema).refine((candidates) => new Set(candidates.map((candidate) => candidate.id)).size === candidates.length,
  "Candidate IDs in a snapshot must be unique");

const snapshotSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string().datetime(),
  candidates: candidatesSchema,
}).strict();

export class CandidateSnapshotSerializer {
  static serialize(candidates: Candidate[], exportedAt: Date): string {
    const snapshot = snapshotSchema.parse({ version: 2, exportedAt: exportedAt.toISOString(), candidates });
    const json = JSON.stringify(snapshot, null, 2) + "\n";
    if (Buffer.byteLength(json, "utf8") > 32 * 1024 * 1024) throw new Error("Candidate snapshot exceeds 32 MB. Use a smaller batch size in a new dataset directory.");
    return json;
  }

  static deserialize(json: string): Candidate[] {
    return snapshotSchema.parse(JSON.parse(json)).candidates;
  }
}
