import { CandidateSearchHit } from "../models/candidateSearchHit";
import { CandidateSearchResult } from "../models/candidateSearchResult";
import { CandidateSearchRanking } from "../ports/candidateSearchRanking";

/** Equal-weight RRF. Scores order results; they are not suitability probabilities. */
export class RankCandidatesByReciprocalRankService implements CandidateSearchRanking {
  private readonly rankConstant = 60;

  public rank(lexicalHits: CandidateSearchHit[], vectorHits: CandidateSearchHit[], limit: number): CandidateSearchResult[] {
    const candidates = new Map<string, CandidateSearchResult>();
    this.addBranchHits(candidates, lexicalHits, "lexical");
    this.addBranchHits(candidates, vectorHits, "vector");
    const results = Array.from(candidates.values());
    for (const result of results) {
      result.score = this.calculateContribution(result.lexicalRank) + this.calculateContribution(result.vectorRank);
    }
    results.sort((left, right) => this.compareCandidates(left, right));
    return results.slice(0, limit);
  }

  private addBranchHits(candidates: Map<string, CandidateSearchResult>, hits: CandidateSearchHit[], branch: "lexical" | "vector"): void {
    for (const [index, hit] of hits.entries()) {
      const id = hit.document.salesforceId;
      let candidate = candidates.get(id);
      if (!candidate) {
        candidate = this.createCandidateResult(hit);
        candidates.set(id, candidate);
      }
      if (branch === "lexical" && candidate.lexicalRank === null) {
        candidate.lexicalRank = index + 1;
        candidate.lexicalScore = hit.score;
      } else if (branch === "vector" && candidate.vectorRank === null) {
        candidate.vectorRank = index + 1;
        candidate.vectorScore = hit.score;
      }
    }
  }

  private createCandidateResult(hit: CandidateSearchHit): CandidateSearchResult {
    return {
      score: 0,
      rankingMethod: "rrf",
      lexicalScore: null,
      vectorScore: null,
      lexicalRank: null,
      vectorRank: null,
      document: hit.document,
    };
  }

  private calculateContribution(rank: number | null): number {
    if (rank === null) {
      return 0;
    }
    return 1 / (this.rankConstant + rank);
  }

  private compareCandidates(left: CandidateSearchResult, right: CandidateSearchResult): number {
    const scoreDifference = right.score - left.score;
    if (scoreDifference !== 0) {
      return scoreDifference;
    }
    if (left.document.salesforceId < right.document.salesforceId) {
      return -1;
    }
    if (left.document.salesforceId > right.document.salesforceId) {
      return 1;
    }
    return 0;
  }
}
