import { CandidateSearchResult } from "../../domain/entities/CandidateSearchResult";
import { SearchRequest } from "../../domain/search/SearchRequest";

export interface CandidateSearch {
  search(request: SearchRequest, limit?: number): Promise<CandidateSearchResult[]>;
}
