import { Candidate } from "../../domain/entities/candidate";
import { CandidateTag } from "../../domain/entities/candidate-enrichment";
import { CandidateReadRepository } from "../ports/candidate-read-repository";
import { CandidateBatchSource } from "../ports/candidate-batch-source";
import { CandidateCoreProfile, CandidateProfileRepository } from "../ports/candidate-profile-repository";
import { CandidateProfileAssembler } from "./candidate-profile-assembler";

export class CandidateEnrichmentService implements CandidateReadRepository, CandidateBatchSource {
  constructor(private readonly repository: CandidateProfileRepository, private readonly assembler: CandidateProfileAssembler) {}
  get extractionKey(): string { return this.repository.extractionKey; }
  async getBatch(limit: number, afterId?: string, report: (message: string) => void = () => {}): Promise<Candidate[]> {
    report("Checking Salesforce schema and fetching candidate profiles");
    return this.enrich(await this.repository.getBatch(limit, afterId), report);
  }
  async getByIds(ids: string[]): Promise<Candidate[]> {
    const result: Candidate[] = [];
    for (let offset = 0; offset < ids.length; offset += 200) {
      result.push(...await this.enrich(await this.repository.getByIds(ids.slice(offset, offset + 200))));
    }
    return result;
  }
  async getAll(): Promise<Candidate[]> {
    throw new Error("Full Salesforce exports require bounded batches. Use fetch-candidates --output-dir with --max-batches, then index-json.");
  }
  private async enrich(cores: CandidateCoreProfile[], report: (message: string) => void = () => {}): Promise<Candidate[]> {
    if (!cores.length) return [];
    report(`Fetching tag associations for ${cores.length} candidates`);
    const associations = await this.repository.getAssociations(cores.map((core) => core.candidate.id));
    const tags = new Map<string, CandidateTag>();
    const attempted = new Set<string>();
    let pending = [...new Set(associations.flatMap((item) => [item.firstTagId, item.secondTagId]).filter((id): id is string => !!id))];
    for (let depth = 0; pending.length; depth++) {
      if (depth >= 32 || attempted.size + pending.length > 100_000) throw new Error("Tag hierarchy exceeds the per-batch limit; checkpoint not advanced.");
      pending.forEach((id) => attempted.add(id));
      report(`Resolving ${pending.length} tags at hierarchy level ${depth + 1}; ${associations.length} associations`);
      const found = await this.repository.getTags(pending);
      found.forEach((tag) => tags.set(tag.id, tag));
      pending = [...new Set(found.map((tag) => tag.parentId).filter((id): id is string => !!id && !attempted.has(id)))];
    }
    report("Resolving employers and assembling candidate documents");
    const employers = new Map((await this.repository.getEmployers([...new Set(cores.map((core) => core.accountId)
      .filter((id): id is string => !!id))])).map((employer) => [employer.id, employer]));
    const byCandidate = new Map<string, typeof associations>();
    for (const association of associations) {
      const group = byCandidate.get(association.candidateId) ?? [];
      group.push(association); byCandidate.set(association.candidateId, group);
    }
    return cores.map((core) => this.assembler.assemble(core, byCandidate.get(core.candidate.id) ?? [], tags,
      core.accountId ? employers.get(core.accountId) : undefined));
  }
}
