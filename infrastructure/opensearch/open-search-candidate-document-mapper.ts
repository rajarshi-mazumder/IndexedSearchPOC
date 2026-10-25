import { z } from "zod";
import { CandidateDocument } from "../../domain/entities/candidate-document";

const optionalText = z.string().nullish().transform((value) => value ?? undefined);
const sourceSchema = z.object({
  salesforceId: z.string(),
  name: z.string(),
  title: optionalText,
  company: optionalText,
  location: optionalText,
  salary: z.number().nullish().transform((value) => value ?? undefined),
  skills: z.array(z.string()),
  skillCategories: z.array(z.string()),
  systems: z.array(z.string()),
  industries: z.array(z.string()),
  subIndustries: z.array(z.string()),
  jobFunctions: z.array(z.string()),
  languages: z.array(z.object({ code: z.string(), level: z.string() })),
  profile: z.string(),
  searchText: z.string(),
  indexedAt: z.string().datetime(),
});

export class OpenSearchCandidateDocumentMapper {
  static toDocument(document: CandidateDocument) {
    const { id, ...candidate } = document.candidate;
    return {
      ...candidate,
      salesforceId: document.salesforceId,
      profile: document.profile,
      searchText: document.searchText,
      indexedAt: document.indexedAt.toISOString(),
    };
  }

  static fromDocument(source: unknown): CandidateDocument {
    // Vectors belong to OpenSearch and may be omitted from its search responses.
    const { salesforceId, profile, searchText, indexedAt, ...candidate } = sourceSchema.parse(source);
    return {
      salesforceId, profile, searchText,
      candidate: { id: salesforceId, ...candidate },
      indexedAt: new Date(indexedAt),
    };
  }
}
