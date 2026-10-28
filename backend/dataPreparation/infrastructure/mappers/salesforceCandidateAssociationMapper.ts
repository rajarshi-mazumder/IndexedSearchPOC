import { z } from "zod";
import { CandidateProfileAssociation } from "../../application/models/candidateProfileAssociation";

const idSchema = z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/);

export class SalesforceCandidateAssociationMapper {
  public static fromRecord(row: Record<string, unknown>): CandidateProfileAssociation {
    return {
      id: idSchema.parse(row.Id),
      candidateId: idSchema.parse(row.candidate__c),
      firstTagId: this.normalizeText(row.firstTag__c),
      secondTagId: this.normalizeText(row.secondTag__c),
      score: this.readFiniteScore(row.tagScore__c),
      modifiedAt: this.normalizeText(row.LastModifiedDate),
    };
  }

  private static readFiniteScore(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    return undefined;
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
