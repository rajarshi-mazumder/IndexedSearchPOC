import { API } from "@opensearch-project/opensearch";
import { CandidateSearchResult } from "../../application/models/candidateSearchResult";
import { OpenSearchCandidateDocumentMapper } from "../../../candidateData/mappers/openSearchCandidateDocumentMapper";
import { CandidateSearchResponseMapping } from "../ports/candidateSearchResponseMapping";

type CandidateSearchHit = API.Search_ResponseBody["hits"]["hits"][number];

export class CandidateSearchResponseMapper implements CandidateSearchResponseMapping {
  public map(response: API.Search_ResponseBody): CandidateSearchResult[] {
    this.assertSearchCompleted(response);
    const results: CandidateSearchResult[] = [];
    for (const hit of response.hits.hits) {
      results.push(this.restoreCandidateResult(hit));
    }
    return results;
  }

  private assertSearchCompleted(response: API.Search_ResponseBody): void {
    if (response.timed_out || (response._shards?.failed ?? 0) > 0) {
      throw new Error("OpenSearch did not complete the hybrid search; refusing partial results.");
    }
  }

  private restoreCandidateResult(hit: CandidateSearchHit): CandidateSearchResult {
    return {
      score: hit._score ?? 0,
      document: OpenSearchCandidateDocumentMapper.fromDocument(hit._source),
    };
  }
}
