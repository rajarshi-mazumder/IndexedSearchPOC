import { z } from "zod";
import { CandidateEnrichment } from "../../../../shared/domain/models/candidateEnrichment";

const idSchema = z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/);

export class SalesforceEmployerMapper {
  public static fromRecord(row: Record<string, unknown>): NonNullable<CandidateEnrichment["employer"]> {
    return {
      id: idSchema.parse(row.Id),
      name: this.normalizeText(row.Name),
      industry: this.normalizeText(row.Industry),
      city: this.normalizeText(row.BillingCity),
      country: this.normalizeText(row.BillingCountry),
      description: this.normalizeText(row.Description),
      website: this.normalizeText(row.Website),
    };
  }

  private static normalizeText(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const text = value.trim();
    if (text.length === 0) {
      return undefined;
    }
    return text;
  }
}
