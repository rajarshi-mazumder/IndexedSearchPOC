import { z } from "zod";
import { Candidate } from "../../domain/entities/candidate";

const optionalText = z.string().nullish().transform((value) => value ?? undefined);
const candidatesSchema = z.array(z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: optionalText,
  company: optionalText,
  location: optionalText,
  salary: z.number().finite().nullish().transform((value) => value ?? undefined),
  skills: z.array(z.string()),
  skillCategories: z.array(z.string()),
  systems: z.array(z.string()),
  industries: z.array(z.string()),
  subIndustries: z.array(z.string()),
  jobFunctions: z.array(z.string()),
  languages: z.array(z.object({ code: z.string(), level: z.string() }).strict()),
}).strict()).refine((candidates) => new Set(candidates.map((candidate) => candidate.id)).size === candidates.length,
  "Candidate IDs in a snapshot must be unique");

const snapshotSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  candidates: candidatesSchema,
}).strict();

export class CandidateSnapshotSerializer {
  static serialize(candidates: Candidate[], exportedAt: Date): string {
    const snapshot = snapshotSchema.parse({ version: 1, exportedAt: exportedAt.toISOString(), candidates });
    return JSON.stringify(snapshot, null, 2) + "\n";
  }

  static deserialize(json: string): Candidate[] {
    return snapshotSchema.parse(JSON.parse(json)).candidates;
  }
}
