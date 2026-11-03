import { API } from "@opensearch-project/opensearch";
import { CandidateVectorTarget } from "../../application/models/candidateSearchAspect";

export interface CandidateVectorQueryMapping {
  map(target: CandidateVectorTarget, query: string, poolSize: number): NonNullable<API.Search_RequestBody["query"]>;
}
