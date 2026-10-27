import { z } from "zod";
import { CandidateCoreProfile } from "../../../application/ports/candidate-profile-repository";

export class SalesforceCandidateCoreMapper {
  static detailName(field: string): string { return field.replace(/__c$/, ""); }
  static fromRecord(row: Record<string, unknown>, missingFields: string[], referenceFields: string[], recordType?: string): CandidateCoreProfile {
    const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
    const warnings = [...missingFields];
    const details: CandidateCoreProfile["details"] = {};
    for (const [field, value] of Object.entries(row).filter(([name]) => name.endsWith("__c"))) {
      const name = this.detailName(field);
      if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") details[name] = value;
      if (value && referenceFields.includes(field)) warnings.push(`Unresolved profile lookup: ${name}=${value}`);
    }
    const location = referenceFields.includes("location__c") ? undefined : text(row.location__c);
    return { candidate: { id: z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/).parse(row.Id), name: z.string().min(1).parse(row.Name), title: text(row.Title),
      location: location ?? ([row.MailingCity, row.MailingState, row.MailingCountry].map(text).filter(Boolean).join(", ") || undefined),
      salary: typeof row.currentSalary__c === "number" ? row.currentSalary__c : undefined,
      skills: [], skillCategories: [], systems: [], industries: [], subIndustries: [], jobFunctions: [], languages: [] },
    accountId: text(row.AccountId), modifiedAt: text(row.LastModifiedDate), recordType, details, warnings };
  }
}
