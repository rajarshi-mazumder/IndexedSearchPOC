import { CandidateCvProfile } from "../../../../../shared/domain/models/candidateCvProfile";

export interface CandidateCvTextFormatter {
  format(cv?: CandidateCvProfile): string[];
}
