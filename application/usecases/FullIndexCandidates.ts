import { CandidateDocument } from "../../domain/entities/CandidateDocument";
import { CandidateReadRepository } from "../ports/CandidateRepository";
import { DocumentIndex } from "../ports/DocumentIndex";
import { EmbeddingProvider } from "../ports/EmbeddingProvider";
import { ProfileGenerator } from "../ports/ProfileGenerator";

export class FullIndexCandidates {
  constructor(
    private readonly repository: CandidateReadRepository,
    private readonly profileGenerator: ProfileGenerator,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly documentIndex: DocumentIndex,
  ) {}

  async execute(): Promise<void> {
    await this.documentIndex.initialize();
    const candidates = await this.repository.getAll();
    console.log(`Indexing ${candidates.length} candidates...`);
    const documents: CandidateDocument[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const hasSearchableData =
        !!candidate.title ||
        candidate.skills.length > 0 ||
        candidate.skillCategories.length > 0 ||
        candidate.systems.length > 0 ||
        candidate.industries.length > 0 ||
        candidate.subIndustries.length > 0 ||
        candidate.jobFunctions.length > 0;

      if (!hasSearchableData) {
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
        candidate: candidate,
        profile,
        embedding,
        indexedAt: new Date(),
      });

      if ((i + 1) % 100 === 0 || i === candidates.length - 1) {
        console.log(`Processed ${i + 1}/${candidates.length}`);
      }
    }

    await this.documentIndex.indexMany(documents);
    console.log("Indexing complete.");
  }
}
