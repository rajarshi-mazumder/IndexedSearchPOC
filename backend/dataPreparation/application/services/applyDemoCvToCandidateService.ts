import { Candidate } from "../../../../shared/domain/models/candidate";
import { CandidateCvGenerator } from "../ports/candidateCvGenerator";
import { CandidateDemoCvTransformer } from "../ports/candidateDemoCvTransformer";
import { CandidateCvAction } from "../models/candidateDemoCvUpdate";

/** Pure candidate transformation. The orchestrator decides which files to save. */
export class ApplyDemoCvToCandidateService implements CandidateDemoCvTransformer {
  public constructor(private readonly generator: CandidateCvGenerator) { }

  public apply(candidate: Candidate, action: CandidateCvAction, seed: string): {
    candidate: Candidate;
    changed: boolean;
  } {
    const copy = structuredClone(candidate);
    let changed = false;
    if (action === "remove") {
      changed = this.removeSyntheticCv(copy);
    }
    else if (this.shouldGenerateCv(copy, action)) {
      this.generateAndAttachCv(copy, seed);
      changed = true;
    }
    return {
      candidate: copy,
      changed
    };
  }

  private removeSyntheticCv(candidate: Candidate): boolean {
    const enrichment = candidate.enrichment;
    if (enrichment?.cvProfile?.source.kind === "synthetic") {
      delete enrichment.cvProfile;
      enrichment.cvProfileRemoved = true;
      return true;
    }
    return false;
  }

  private shouldGenerateCv(candidate: Candidate, action: CandidateCvAction): boolean {
    return !candidate.enrichment?.cvProfile || action === "regenerate" || action === "preview";
  }

  private generateAndAttachCv(candidate: Candidate, seed: string): void {
    if (!candidate.enrichment) {
      candidate.enrichment = {
        version: 2,
        details: {},
        tags: [],
        associations: [],
        warnings: []
      };
    }
    candidate.enrichment.cvProfile = this.generator.generate(candidate, seed);
    delete candidate.enrichment.cvProfileRemoved;
  }
}
