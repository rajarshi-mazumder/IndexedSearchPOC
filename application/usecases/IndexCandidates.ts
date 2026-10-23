import { CandidateDocument } from "../../domain/entities/CandidateDocument";
import { CandidateReadRepository } from "../ports/CandidateRepository";
import { DocumentIndex } from "../ports/DocumentIndex";
import { EmbeddingProvider } from "../ports/EmbeddingProvider";
import { ProfileGenerator } from "../ports/ProfileGenerator";

export class IndexCandidates {
  constructor(
    private readonly repository: CandidateReadRepository,
    private readonly profileGenerator: ProfileGenerator,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly documentIndex: DocumentIndex,
  ) {}

  async execute(ids: string[], additionalSkills: Record<string, string[]> = {}): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.documentIndex.initialize();
    const candidates = await this.repository.getByIds(ids);
    console.log(`Reindexing ${candidates.length} candidate(s)...`);
    const documents: CandidateDocument[] = [];

    for (const candidate of candidates) {
      const newSkills = additionalSkills[candidate.id] ?? [];
      if (newSkills.length > 0) {
        candidate.skills = [...new Set([...candidate.skills, ...newSkills])];
        console.log(`Enriched ${candidate.name} with: ${newSkills.join(", ")}`);
      }
      const hasSearchableData =
        !!candidate.title ||
        candidate.skills.length > 0 ||
        candidate.skillCategories.length > 0 ||
        candidate.systems.length > 0 ||
        candidate.industries.length > 0 ||
        candidate.subIndustries.length > 0 ||
        candidate.jobFunctions.length > 0;

      if (!hasSearchableData) {
        console.log(`Skipping ${candidate.id} - no searchable data`);
        continue;
      }
      const profile = this.profileGenerator.generate(candidate);
      const embeddingText = this.profileGenerator.generateEmbeddingText(candidate);
      const embedding = await this.embeddingProvider.embedDocument(embeddingText);
      if (embedding.length !== 768) {
        throw new Error(`Expected a 768-dimensional embedding for candidate ${candidate.id}, received ${embedding.length}`);
      }
      documents.push({
        salesforceId: candidate.id,
        candidate,
        profile,
        embedding,
        indexedAt: new Date(),
      });
      console.log(`Prepared ${candidate.id} - ${candidate.name}`);
    }
    if (documents.length > 0) {
      await this.documentIndex.indexMany(documents);
    }
    console.log(`Reindexed ${documents.length} candidate(s).`);
  }
}
