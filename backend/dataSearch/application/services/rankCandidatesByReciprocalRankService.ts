import { CandidateSearchHit } from "../models/candidateSearchHit";
import { CandidateSearchResult } from "../models/candidateSearchResult";
import { CandidateSearchBranch, CandidateSearchBranchHits } from "../models/candidateSearchBranchHits";
import { CandidateSearchRanking } from "../ports/candidateSearchRanking";

/** Equal-weight RRF over every searched branch. Scores order results; they are not suitability probabilities. */
export class RankCandidatesByReciprocalRankService implements CandidateSearchRanking {
  private readonly rankConstant = 60;

  public rank(branches: CandidateSearchBranchHits[], limit: number): CandidateSearchResult[] {
    const candidates = new Map<string, CandidateSearchResult>();
    const contributions = new Map<string, number>();
    for (const { branch, hits } of branches) {
      this.addBranchHits(candidates, contributions, branch, hits);
    }
    const results = Array.from(candidates.values());
    for (const result of results) {
      result.score = contributions.get(result.document.salesforceId) ?? 0;
    }
    results.sort((left, right) => this.compareCandidates(left, right));
    return results.slice(0, limit);
  }

  private addBranchHits(
    candidates: Map<string, CandidateSearchResult>,
    contributions: Map<string, number>,
    branch: CandidateSearchBranch,
    hits: CandidateSearchHit[],
  ): void {
    const seen = new Set<string>();
    for (const [index, hit] of hits.entries()) {
      const id = hit.document.salesforceId;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      let candidate = candidates.get(id);
      if (!candidate) {
        candidate = this.createCandidateResult(hit);
        candidates.set(id, candidate);
      }
      this.recordBranchRank(candidate, branch, index + 1, hit.score);
      contributions.set(id, (contributions.get(id) ?? 0) + this.calculateContribution(index + 1));
    }
  }

  private recordBranchRank(candidate: CandidateSearchResult, branch: CandidateSearchBranch, rank: number, score: number | null): void {
    if (branch === "lexical") {
      candidate.lexicalRank = rank;
      candidate.lexicalScore = score;
    } else if (branch === "overall") {
      candidate.vectorRank = rank;
      candidate.vectorScore = score;
    } else {
      candidate.aspectRanks[branch] = rank;
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
      aspectRanks: {},
      document: hit.document,
    };
  }

  private calculateContribution(rank: number): number {
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
