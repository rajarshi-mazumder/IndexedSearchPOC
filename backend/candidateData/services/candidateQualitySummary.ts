import { Candidate } from "../../../shared/domain/models/candidate";

export class CandidateQualitySummary {
  static summarize(candidates: Candidate[]) {
    return { total: candidates.length, withSkills: candidates.filter((candidate) => candidate.skills.length > 0).length,
      withSystems: candidates.filter((candidate) => candidate.systems.length > 0).length,
      withLanguages: candidates.filter((candidate) => candidate.languages.length > 0).length,
      withWarnings: candidates.filter((candidate) => candidate.enrichment?.warnings.length).length,
      associations: candidates.reduce((total, candidate) => total + (candidate.enrichment?.associations.length ?? 0), 0) };
  }
}
