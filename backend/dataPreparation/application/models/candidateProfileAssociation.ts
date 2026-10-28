import { CandidateTagAssociation } from "../../../../shared/domain/models/candidateEnrichment";

export interface CandidateProfileAssociation extends CandidateTagAssociation {
  candidateId: string;
}
