import { SearchFilters } from "./SearchFilters";

export interface SearchRequest {
  originalQuery: string;
  semanticQuery: string;
  keywords: string[];
  phrases: string[];
  filters: SearchFilters;
}
