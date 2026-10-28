import { z } from "zod";
import { CandidateCoreProfile } from "../../application/models/candidateCoreProfile";

export class SalesforceCandidateCoreMapper {
  public static detailName(field: string): string {
    return field.replace(/__c$/, "");
  }

  public static fromRecord(
    row: Record<string, unknown>,
    missingFields: string[],
    referenceFields: string[],
    recordType?: string
  ): CandidateCoreProfile {
    const warnings = [...missingFields];
    const details = this.collectCustomDetails(row, referenceFields, warnings);
    return {
      candidate: {
        id: z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/).parse(row.Id),
        name: z.string().min(1).parse(row.Name),
        title: this.normalizeText(row.Title),
        location: this.readLocation(row, referenceFields),
        salary: this.readSalary(row.currentSalary__c),
        skills: [],
        skillCategories: [],
        systems: [],
        industries: [],
        subIndustries: [],
        jobFunctions: [],
        languages: [],
      },
      accountId: this.normalizeText(row.AccountId),
      modifiedAt: this.normalizeText(row.LastModifiedDate),
      recordType,
      details,
      warnings,
    };
  }

  private static collectCustomDetails(row: Record<string, unknown>, referenceFields: string[], warnings: string[]): CandidateCoreProfile["details"] {
    const details: CandidateCoreProfile["details"] = {};
    for (const [field, value] of Object.entries(row)) {
      if (!field.endsWith("__c")) {
        continue;
      }
      const name = this.detailName(field);
      if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        details[name] = value;
      }
      if (value && referenceFields.includes(field)) {
        warnings.push(`Unresolved profile lookup: ${name}=${value}`);
      }
    }
    return details;
  }

  private static readLocation(row: Record<string, unknown>, referenceFields: string[]): string | undefined {
    if (!referenceFields.includes("location__c")) {
      const location = this.normalizeText(row.location__c);
      if (location !== undefined) {
        return location;
      }
    }
    const address: string[] = [];
    for (const value of [row.MailingCity, row.MailingState, row.MailingCountry]) {
      const text = this.normalizeText(value);
      if (text) {
        address.push(text);
      }
    }
    if (address.length === 0) {
      return undefined;
    }
    return address.join(", ");
  }

  private static readSalary(value: unknown): number | undefined {
    if (typeof value === "number") {
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
