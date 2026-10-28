import { API } from "@opensearch-project/opensearch";
import { CandidateSearchHit } from "../../application/models/candidateSearchHit";
import { OpenSearchCandidateDocumentMapper } from "../../../candidateData/mappers/openSearchCandidateDocumentMapper";
import { CandidateSearchResponseMapping } from "../ports/candidateSearchResponseMapping";

type OpenSearchHit = API.Search_ResponseBody["hits"]["hits"][number];

export class CandidateSearchResponseMapper implements CandidateSearchResponseMapping {
  public map(response: API.Search_ResponseBody): CandidateSearchHit[] {
    this.assertSearchCompleted(response);
    const results: CandidateSearchHit[] = [];
    for (const hit of response.hits.hits) {
      results.push(this.restoreCandidateResult(hit));
    }
    return results;
  }

  private assertSearchCompleted(response: API.Search_ResponseBody): void {
    if (response.timed_out || (response._shards?.failed ?? 0) > 0) {
      throw new Error("OpenSearch did not complete a search branch; refusing partial results.");
    }
  }

  private restoreCandidateResult(hit: OpenSearchHit): CandidateSearchHit {
    return {
      score: hit._score ?? null,
      document: OpenSearchCandidateDocumentMapper.fromDocument(hit._source),
    };
  }
}
