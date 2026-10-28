import { API } from "@opensearch-project/opensearch";
import { CandidateSearchHit } from "../../application/models/candidateSearchHit";

export interface CandidateSearchResponseMapping {
  map(response: API.Search_ResponseBody): CandidateSearchHit[];
}
