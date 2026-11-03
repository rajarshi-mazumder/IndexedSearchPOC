import { z } from "zod";
import { CandidateDocument } from "../models/candidateDocument";
import { candidateEnrichmentSchema } from "../repositories/candidateEnrichmentSchema";

const optionalText = z.string().nullish().transform((value) => value ?? undefined);
const sourceSchema = z.object({
  salesforceId: z.string(),
  name: z.string(),
  title: optionalText,
  company: optionalText,
  location: optionalText,
  salary: z.number().nullish().transform((value) => value ?? undefined),
  enrichment: candidateEnrichmentSchema.optional(),
  skills: z.array(z.string()),
  skillCategories: z.array(z.string()),
  systems: z.array(z.string()),
  industries: z.array(z.string()),
  subIndustries: z.array(z.string()),
  jobFunctions: z.array(z.string()),
  languages: z.array(z.object({ code: z.string(), level: z.string() })),
  profile: z.string(),
  searchText: z.string(),
  skillsText: z.string().optional(),
  languagesText: z.string().optional(),
  regionText: z.string().optional(),
  indexedAt: z.string().datetime(),
});

type CandidateAspectTexts = Pick<CandidateDocument, "skillsText" | "languagesText" | "regionText">;

export class OpenSearchCandidateDocumentMapper {
  public static toDocument(document: CandidateDocument) {
    const { id, ...candidate } = document.candidate;
    return {
      ...candidate,
      salesforceId: document.salesforceId,
      profile: document.profile,
      searchText: document.searchText,
      ...this.copyAspectTexts(document),
      indexedAt: document.indexedAt.toISOString(),
    };
  }

  public static fromDocument(source: unknown): CandidateDocument {
    // Vectors belong to OpenSearch and may be omitted from its search responses.
    const { salesforceId, profile, searchText, skillsText, languagesText, regionText, indexedAt, ...candidate } = this.parseSource(source);
    return {
      salesforceId, profile, searchText,
      ...this.copyAspectTexts({ skillsText, languagesText, regionText }),
      candidate: { id: salesforceId, ...candidate },
      indexedAt: new Date(indexedAt),
    };
  }

  /** Absent texts stay absent, so the ingest pipeline skips their vectors. */
  private static copyAspectTexts(texts: CandidateAspectTexts): CandidateAspectTexts {
    const copied: CandidateAspectTexts = {};
    if (texts.skillsText !== undefined) {
      copied.skillsText = texts.skillsText;
    }
    if (texts.languagesText !== undefined) {
      copied.languagesText = texts.languagesText;
    }
    if (texts.regionText !== undefined) {
      copied.regionText = texts.regionText;
    }
    return copied;
  }
  private static parseSource(source: unknown): z.infer<typeof sourceSchema> {
    return sourceSchema.parse(source);
  }
}
