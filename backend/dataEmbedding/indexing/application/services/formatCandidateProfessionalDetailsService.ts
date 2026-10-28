import { Candidate } from "../../../../../shared/domain/models/candidate";
import { CandidateProfessionalDetailsFormatter } from "../ports/candidateProfessionalDetailsFormatter";

export class FormatCandidateProfessionalDetailsService implements CandidateProfessionalDetailsFormatter {
  public format(candidate: Candidate): string[] {
    const fields: Record<string, string> = {
      desiredTitle: "Desired role",
      positionLevel: "Position level",
      highestEducationalQualification: "Education",
      highestEducationalInstitute: "Institute",
      educationalSpecialization: "Educational specialization",
      jobType: "Job type",
    };
    const sections: string[] = [];
    for (const [key, label] of Object.entries(fields)) {
      const value = this.readDetail(candidate, key);
      const unresolved = this.hasUnresolvedLookup(candidate, key);
      if (typeof value === "string" && value.trim() && !unresolved) {
        sections.push(`${label}: ${value.trim()}`);
      }
    }
    return sections;
  }

  private readDetail(candidate: Candidate, key: string): unknown {
    const resolved = candidate.enrichment?.resolvedDetails?.[key];
    if (resolved != null) {
      return resolved;
    }
    return candidate.enrichment?.details?.[key];
  }

  private hasUnresolvedLookup(candidate: Candidate, key: string): boolean {
    if (!candidate.enrichment) {
      return false;
    }
    for (const warning of candidate.enrichment.warnings) {
      if (warning.startsWith(`Unresolved profile lookup: ${key}=`)) {
        return true;
      }
    }
    return false;
  }
}
