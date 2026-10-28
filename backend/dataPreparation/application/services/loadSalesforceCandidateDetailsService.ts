import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateEnrichment, CandidateTag } from "../../../../shared/domain/models/candidateEnrichment";
import { CandidateReadRepository } from "../../../candidateData/ports/candidateReadRepository";
import { CandidateBatchSource } from "../ports/candidateBatchSource";
import { CandidateProfileRepository } from "../ports/candidateProfileRepository";
import { CandidateCoreProfile } from "../models/candidateCoreProfile";
import { CandidateProfileAssociation } from "../models/candidateProfileAssociation";
import { CandidateDetailsCombiner } from "../ports/candidateDetailsCombiner";

type Employer = NonNullable<CandidateEnrichment["employer"]>;

type ReportProgress = (message: string) => void;

export class LoadSalesforceCandidateDetailsService implements CandidateReadRepository, CandidateBatchSource {
  public constructor(
    private readonly repository: CandidateProfileRepository,
    private readonly combineCandidateDetails: CandidateDetailsCombiner
  ) { }

  public get extractionKey(): string {
    return this.repository.extractionKey;
  }

  public async getBatch(limit: number, afterId?: string, report: ReportProgress = () => { }): Promise<Candidate[]> {
    report("Checking Salesforce schema and fetching candidate profiles");
    const profiles = await this.repository.getBatch(limit, afterId);
    return this.loadRelationshipsAndCombineCandidateDetails(profiles, report);
  }

  public async getByIds(ids: string[]): Promise<Candidate[]> {
    const candidates: Candidate[] = [];
    for (let offset = 0; offset < ids.length; offset += 200) {
      const selectedIds = ids.slice(offset, offset + 200);
      const profiles = await this.repository.getByIds(selectedIds);
      const batch = await this.loadRelationshipsAndCombineCandidateDetails(profiles);
      candidates.push(...batch);
    }
    return candidates;
  }

  public async getAll(): Promise<Candidate[]> {
    throw new Error("Full Salesforce exports require bounded batches. Use fetch-candidates --output-dir with --max-batches, then index-json.");
  }

  private async loadRelationshipsAndCombineCandidateDetails(profiles: CandidateCoreProfile[], report: ReportProgress = () => { }): Promise<Candidate[]> {
    if (profiles.length === 0) {
      return [];
    }
    report(`Fetching tag associations for ${profiles.length} candidates`);
    const candidateIds = this.collectCandidateIds(profiles);
    const associations = await this.repository.getAssociations(candidateIds);
    const tags = await this.loadTagsAndTheirParents(associations, report);
    report("Resolving employers and assembling candidate documents");
    const employers = await this.loadEmployers(profiles);
    const associationsByCandidate = this.groupAssociationsByCandidate(associations);
    return this.combineProfilesWithRelationships(profiles, associationsByCandidate, tags, employers);
  }

  private collectCandidateIds(profiles: CandidateCoreProfile[]): string[] {
    const ids: string[] = [];
    for (const profile of profiles) {
      ids.push(profile.candidate.id);
    }
    return ids;
  }

  private collectAssociatedTagIds(associations: CandidateProfileAssociation[]): string[] {
    const ids = new Set<string>();
    for (const association of associations) {
      if (association.firstTagId) {
        ids.add(association.firstTagId);
      }
      if (association.secondTagId) {
        ids.add(association.secondTagId);
      }
    }
    return [...ids];
  }

  private async loadTagsAndTheirParents(associations: CandidateProfileAssociation[], report: ReportProgress): Promise<Map<string, CandidateTag>> {
    const tags = new Map<string, CandidateTag>();
    const attemptedIds = new Set<string>();
    let pendingIds = this.collectAssociatedTagIds(associations);
    for (let depth = 0; pendingIds.length > 0; depth++) {
      this.validateTagHierarchyLimit(depth, attemptedIds.size, pendingIds.length);
      for (const id of pendingIds) {
        attemptedIds.add(id);
      }
      report(`Resolving ${pendingIds.length} tags at hierarchy level ${depth + 1}; ${associations.length} associations`);
      const foundTags = await this.repository.getTags(pendingIds);
      for (const tag of foundTags) {
        tags.set(tag.id, tag);
      }
      pendingIds = this.collectUnrequestedParentIds(foundTags, attemptedIds);
    }
    return tags;
  }

  private validateTagHierarchyLimit(depth: number, attemptedCount: number, pendingCount: number): void {
    if (depth >= 32 || attemptedCount + pendingCount > 100000) {
      throw new Error("Tag hierarchy exceeds the per-batch limit; checkpoint not advanced.");
    }
  }

  private collectUnrequestedParentIds(tags: CandidateTag[], attemptedIds: Set<string>): string[] {
    const parentIds = new Set<string>();
    for (const tag of tags) {
      if (tag.parentId && !attemptedIds.has(tag.parentId)) {
        parentIds.add(tag.parentId);
      }
    }
    return [...parentIds];
  }

  private async loadEmployers(profiles: CandidateCoreProfile[]): Promise<Map<string, Employer>> {
    const accountIds = new Set<string>();
    for (const profile of profiles) {
      if (profile.accountId) {
        accountIds.add(profile.accountId);
      }
    }
    const employers = await this.repository.getEmployers([...accountIds]);
    const employersById = new Map<string, Employer>();
    for (const employer of employers) {
      employersById.set(employer.id, employer);
    }
    return employersById;
  }

  private groupAssociationsByCandidate(associations: CandidateProfileAssociation[]): Map<string, CandidateProfileAssociation[]> {
    const groups = new Map<string, CandidateProfileAssociation[]>();
    for (const association of associations) {
      let group = groups.get(association.candidateId);
      if (!group) {
        group = [];
        groups.set(association.candidateId, group);
      }
      group.push(association);
    }
    return groups;
  }

  private combineProfilesWithRelationships(
    profiles: CandidateCoreProfile[],
    associationsByCandidate: Map<string, CandidateProfileAssociation[]>,
    tags: Map<string, CandidateTag>,
    employers: Map<string, Employer>
  ): Candidate[] {
    const candidates: Candidate[] = [];
    for (const profile of profiles) {
      let associations = associationsByCandidate.get(profile.candidate.id);
      if (!associations) {
        associations = [];
      }
      let employer: Employer | undefined;
      if (profile.accountId) {
        employer = employers.get(profile.accountId);
      }
      const candidate = this.combineCandidateDetails.assemble(profile, associations, tags, employer);
      candidates.push(candidate);
    }
    return candidates;
  }
}
