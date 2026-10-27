import { Candidate } from "../../domain/entities/candidate";
import { CandidateEnrichment, CandidateTag } from "../../domain/entities/candidate-enrichment";
import { CandidateCoreProfile, CandidateProfileAssociation } from "../ports/candidate-profile-repository";

/** Pure joins: no queries, configuration reads, or invented professional facts. */
export class CandidateProfileAssembler {
  assemble(core: CandidateCoreProfile, associations: CandidateProfileAssociation[], tags: Map<string, CandidateTag>,
    employer?: CandidateEnrichment["employer"]): Candidate {
    const candidate: Candidate = { ...core.candidate, languages: [...core.candidate.languages] };
    const warnings = [...core.warnings];
    const included = new Map<string, CandidateTag>();
    const visit = (id: string | undefined, path = new Set<string>()): void => {
      if (!id) return;
      if (path.has(id)) { warnings.push(`Tag hierarchy cycle: ${id}`); return; }
      if (included.has(id)) return;
      const tag = tags.get(id);
      if (!tag) { warnings.push(`Unresolved tag: ${id}`); return; }
      included.set(id, tag);
      if (!tag.label) warnings.push(`Tag has no readable label: ${id}`);
      if (!tag.category) warnings.push(`Unclassified tag type: ${tag.type ?? "missing"} (${id})`);
      visit(tag.parentId, new Set([...path, id]));
    };
    for (const association of associations) { visit(association.firstTagId); visit(association.secondTagId); }
    for (const category of ["skills", "skillCategories", "systems", "industries", "subIndustries", "jobFunctions"] as const) {
      candidate[category] = [...new Set([...candidate[category], ...[...included.values()]
        .filter((tag) => tag.category === category && tag.label).map((tag) => tag.label!)])];
    }
    for (const association of associations) {
      const first = association.firstTagId ? tags.get(association.firstTagId) : undefined;
      const second = association.secondTagId ? tags.get(association.secondTagId) : undefined;
      if (first?.category === "language" && first.label) {
        const level = second?.category === "proficiency" ? second.label ?? "" : "";
        if (!level) warnings.push(`Language proficiency unresolved: ${association.id}`);
        candidate.languages.push({ code: first.label, level });
      }
    }
    candidate.languages = candidate.languages.filter((item, index, items) =>
      items.findIndex((other) => other.code === item.code && other.level === item.level) === index);
    if (core.accountId && !employer) warnings.push(`Unresolved employer: ${core.accountId}`);
    candidate.company = employer?.name ?? candidate.company;
    if (!associations.length) warnings.push("No candidate tag associations returned");
    candidate.enrichment = { version: 2, modifiedAt: core.modifiedAt, recordType: core.recordType,
      details: core.details, resolvedDetails: core.resolvedDetails, employer, tags: [...included.values()],
      associations: associations.map(({ candidateId: _, ...association }) => association), warnings: [...new Set(warnings)] };
    return candidate;
  }
}
