import { z } from "zod";
import { candidateCvProfileSchema } from "./candidateCvProfileSchema";

export const candidateEnrichmentSchema = z.object({
  cvProfileRemoved: z.literal(true).optional(),
  cvProfile: candidateCvProfileSchema.optional(),
  version: z.literal(2), modifiedAt: z.string().optional(), recordType: z.string().optional(),
  details: z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean(), z.null()])),
  resolvedDetails: z.record(z.string(), z.string()).optional(),
  employer: z.object({ id: z.string(), name: z.string().optional(), industry: z.string().optional(),
    city: z.string().optional(), country: z.string().optional(), description: z.string().optional(), website: z.string().optional() }).strict().optional(),
  tags: z.array(z.object({ id: z.string(), label: z.string().optional(), type: z.string().optional(), parentId: z.string().optional(),
    category: z.enum(["skills", "skillCategories", "systems", "industries", "subIndustries", "jobFunctions", "language", "proficiency"]).optional() }).strict()),
  associations: z.array(z.object({ id: z.string(), firstTagId: z.string().optional(), secondTagId: z.string().optional(),
    score: z.number().finite().optional(), modifiedAt: z.string().optional() }).strict()),
  warnings: z.array(z.string()),
}).strict();
