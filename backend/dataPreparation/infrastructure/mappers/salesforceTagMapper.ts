import { z } from "zod";
import { CandidateTag, CandidateTagCategory } from "../../../../shared/domain/models/candidateEnrichment";

const idSchema = z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/);

const categoryDefaults: Record<string, CandidateTagCategory> = {
  skill: "skills",
  skills: "skills",
  skillcode: "skills",
  skillcategory: "skillCategories",
  system: "systems",
  systems: "systems",
  technology: "systems",
  industry: "industries",
  subindustry: "subIndustries",
  jobfunction: "jobFunctions",
  language: "language",
  languagelevel: "proficiency",
  proficiency: "proficiency",
};

export class SalesforceTagMapper {
  public static fromRecord(
    row: Record<string, unknown>,
    type: string | undefined,
    tagTypes: Record<string, CandidateTagCategory>
  ): CandidateTag {
    return {
      id: idSchema.parse(row.Id),
      label: this.readTagLabel(row),
      type,
      category: this.resolveCategory(type, tagTypes),
      parentId: this.normalizeText(row.tagParent__c),
    };
  }

  private static readTagLabel(row: Record<string, unknown>): string | undefined {
    const label = this.normalizeText(row.label__c);
    if (label !== undefined) {
      return label;
    }
    return this.normalizeText(row.Name);
  }

  private static resolveCategory(type: string | undefined, tagTypes: Record<string, CandidateTagCategory>): CandidateTagCategory | undefined {
    if (!type) {
      return undefined;
    }
    const configuredCategory = tagTypes[type];
    if (configuredCategory != null) {
      return configuredCategory;
    }
    const normalizedType = type.toLowerCase().replace(/[^a-z0-9]/g, "");
    return categoryDefaults[normalizedType];
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
