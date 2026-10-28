import { Candidate } from "../../../../shared/domain/models/candidate";

export interface CandidateQualitySummarizer {
  summarize(candidates: Candidate[]): {
    total: number;
    withSkills: number;
    withSystems: number;
    withLanguages: number;
    withWarnings: number;
    associations: number;
  };
}
