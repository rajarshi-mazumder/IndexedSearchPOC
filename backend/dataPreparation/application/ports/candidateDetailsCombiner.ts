import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateEnrichment, CandidateTag } from "../../../../shared/domain/models/candidateEnrichment";
import { CandidateCoreProfile } from "../models/candidateCoreProfile";
import { CandidateProfileAssociation } from "../models/candidateProfileAssociation";

export interface CandidateDetailsCombiner {
  assemble(
    core: CandidateCoreProfile,
    associations: CandidateProfileAssociation[],
    tags: Map<string, CandidateTag>,
    employer?: CandidateEnrichment["employer"]
  ): Candidate;
}
