import { API } from "@opensearch-project/opensearch";

export interface CandidateLexicalQueryMapping {
  map(query: string): NonNullable<API.Search_RequestBody["query"]>;
}
