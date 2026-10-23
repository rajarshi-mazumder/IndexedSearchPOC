import { SearchRequest } from "../../domain/search/SearchRequest";

export interface SearchRequestBuilder {
  build(query: string): Promise<SearchRequest>;
}
