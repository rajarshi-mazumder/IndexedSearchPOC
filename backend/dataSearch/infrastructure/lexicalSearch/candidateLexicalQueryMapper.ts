import { API } from "@opensearch-project/opensearch";
import { CandidateLexicalQueryMapping } from "../ports/candidateLexicalQueryMapping";

export class CandidateLexicalQueryMapper implements CandidateLexicalQueryMapping {
  public map(query: string): NonNullable<API.Search_RequestBody["query"]> {
    return {
      multi_match: {
        query,
        // Candidate evidence spans fields; long natural-language queries
        // should not require most words to occur in one field.
        type: "cross_fields",
        fields: this.getSearchFieldsWithBoosts(),
        minimum_should_match: "2<30%",
      },
    };
  }

  private getSearchFieldsWithBoosts(): string[] {
    return ["skills^10", "title^8", "jobFunctions^6", "systems^5", "skillCategories^4", "profile"];
  }
}
