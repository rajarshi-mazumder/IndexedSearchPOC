import { API } from "@opensearch-project/opensearch";

export interface CandidateIndependentSearchRequestMapping {
  mapLexical(query: string, poolSize: number): API.Search_Request;
  mapVector(query: string, poolSize: number): API.Search_Request;
}
