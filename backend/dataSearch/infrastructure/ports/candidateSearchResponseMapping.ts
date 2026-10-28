import { API } from "@opensearch-project/opensearch";
import { CandidateSearchResult } from "../../application/models/candidateSearchResult";

export interface CandidateSearchResponseMapping {
  map(response: API.Search_ResponseBody): CandidateSearchResult[];
}
