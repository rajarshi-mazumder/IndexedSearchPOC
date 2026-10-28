import { API } from "@opensearch-project/opensearch";

export interface CandidateVectorQueryMapping {
  map(query: string, poolSize: number): NonNullable<API.Search_RequestBody["query"]>;
}
