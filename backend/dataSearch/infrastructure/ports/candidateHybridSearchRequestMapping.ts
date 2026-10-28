import { API } from "@opensearch-project/opensearch";

export interface CandidateHybridSearchRequestMapping {
  map(query: string, limit: number): API.Search_Request;
}
