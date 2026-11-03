import { API } from "@opensearch-project/opensearch";
import { CandidateVectorTarget } from "../../application/models/candidateSearchAspect";

export interface CandidateIndependentSearchRequestMapping {
  mapLexical(query: string, poolSize: number): API.Search_Request;
  mapVector(target: CandidateVectorTarget, query: string, poolSize: number): API.Search_Request;
}
