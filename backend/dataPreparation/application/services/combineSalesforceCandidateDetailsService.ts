import { CandidateDetailsCombiner } from "../ports/candidateDetailsCombiner";
import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateEnrichment, CandidateTag, CandidateTagAssociation } from "../../../../shared/domain/models/candidateEnrichment";
import { CandidateCoreProfile } from "../models/candidateCoreProfile";
import { CandidateProfileAssociation } from "../models/candidateProfileAssociation";

/** Pure joins: no queries, configuration reads, or invented professional facts. */
export class CombineSalesforceCandidateDetailsService implements CandidateDetailsCombiner {
  public assemble(
    core: CandidateCoreProfile,
    associations: CandidateProfileAssociation[],
    tags: Map<string, CandidateTag>,
    employer?: CandidateEnrichment["employer"]
  ): Candidate {
    const candidate: Candidate = {
      ...core.candidate,
      languages: [...core.candidate.languages]
    };
    const warnings = [...core.warnings];
    const includedTags = this.collectCandidateTags(associations, tags, warnings);
    this.addCategorizedTagLabels(candidate, includedTags);
    this.addCandidateLanguages(candidate, associations, tags, warnings);
    this.addEmployer(candidate, core.accountId, employer, warnings);
    if (associations.length === 0) {
      warnings.push("No candidate tag associations returned");
    }
    candidate.enrichment = {
      version: 2,
      modifiedAt: core.modifiedAt,
      recordType: core.recordType,
      details: core.details,
      resolvedDetails: core.resolvedDetails,
      employer,
      tags: [...includedTags.values()],
      associations: this.removeCandidateIdsFromAssociations(associations),
      warnings: [...new Set(warnings)],
    };
    return candidate;
  }

  private collectCandidateTags(
    associations: CandidateProfileAssociation[],
    tags: Map<string, CandidateTag>,
    warnings: string[]
  ): Map<string, CandidateTag> {
    const includedTags = new Map<string, CandidateTag>();
    for (const association of associations) {
      this.includeTagAndParents(association.firstTagId, tags, includedTags, warnings, new Set<string>());
      this.includeTagAndParents(association.secondTagId, tags, includedTags, warnings, new Set<string>());
    }
    return includedTags;
  }

  private includeTagAndParents(
    id: string | undefined,
    tags: Map<string, CandidateTag>,
    includedTags: Map<string, CandidateTag>,
    warnings: string[],
    path: Set<string>
  ): void {
    if (!id) {
      return;
    }
    if (path.has(id)) {
      warnings.push(`Tag hierarchy cycle: ${id}`);
      return;
    }
    if (includedTags.has(id)) {
      return;
    }
    const tag = tags.get(id);
    if (!tag) {
      warnings.push(`Unresolved tag: ${id}`);
      return;
    }
    includedTags.set(id, tag);
    this.reportMissingTagDetails(tag, warnings);
    const parentPath = new Set([...path, id]);
    this.includeTagAndParents(tag.parentId, tags, includedTags, warnings, parentPath);
  }

  private reportMissingTagDetails(tag: CandidateTag, warnings: string[]): void {
    if (!tag.label) {
      warnings.push(`Tag has no readable label: ${tag.id}`);
    }
    if (!tag.category) {
      let type = tag.type;
      if (type === undefined || type === null) {
        type = "missing";
      }
      warnings.push(`Unclassified tag type: ${type} (${tag.id})`);
    }
  }

  private addCategorizedTagLabels(candidate: Candidate, includedTags: Map<string, CandidateTag>): void {
    const categories = ["skills", "skillCategories", "systems", "industries", "subIndustries", "jobFunctions"] as const;
    for (const category of categories) {
      const labels = new Set(candidate[category]);
      for (const tag of includedTags.values()) {
        if (tag.category === category && tag.label) {
          labels.add(tag.label);
        }
      }
      candidate[category] = [...labels];
    }
  }

  private addCandidateLanguages(
    candidate: Candidate,
    associations: CandidateProfileAssociation[],
    tags: Map<string, CandidateTag>,
    warnings: string[]
  ): void {
    for (const association of associations) {
      const language = this.findAssociatedTag(association.firstTagId, tags);
      const proficiency = this.findAssociatedTag(association.secondTagId, tags);
      if (language?.category === "language" && language.label) {
        const level = this.readProficiencyLabel(proficiency);
        if (!level) {
          warnings.push(`Language proficiency unresolved: ${association.id}`);
        }
        candidate.languages.push({
          code: language.label,
          level
        });
      }
    }
    candidate.languages = this.removeDuplicateLanguages(candidate.languages);
  }

  private findAssociatedTag(id: string | undefined, tags: Map<string, CandidateTag>): CandidateTag | undefined {
    if (id) {
      return tags.get(id);
    }
    return undefined;
  }

  private readProficiencyLabel(tag: CandidateTag | undefined): string {
    if (tag?.category === "proficiency" && tag.label != null) {
      return tag.label;
    }
    return "";
  }

  private removeDuplicateLanguages(languages: Candidate["languages"]): Candidate["languages"] {
    const unique: Candidate["languages"] = [];
    for (const language of languages) {
      let duplicate = false;
      for (const existing of unique) {
        if (existing.code === language.code && existing.level === language.level) {
          duplicate = true;
          break;
        }
      }
      if (!duplicate) {
        unique.push(language);
      }
    }
    return unique;
  }

  private addEmployer(
    candidate: Candidate,
    accountId: string | undefined,
    employer: CandidateEnrichment["employer"],
    warnings: string[]
  ): void {
    if (accountId && !employer) {
      warnings.push(`Unresolved employer: ${accountId}`);
    }
    // Assign even when absent to retain the original document shape.
    let company = candidate.company;
    if (employer?.name != null) {
      company = employer.name;
    }
    candidate.company = company;
  }

  private removeCandidateIdsFromAssociations(associations: CandidateProfileAssociation[]): CandidateTagAssociation[] {
    const details: CandidateTagAssociation[] = [];
    for (const association of associations) {
      const { candidateId, ...detail } = association;
      details.push(detail);
    }
    return details;
  }
}
