import { CandidateEmbeddingModel } from "../ports/candidateEmbeddingModel";
import { CandidateIndexState, CandidateOpenSearchResources } from "../ports/candidateOpenSearchResources";

export class SetupCandidateOpenSearchResourcesUseCase {
  public constructor(
    private readonly resources: CandidateOpenSearchResources,
    private readonly model: CandidateEmbeddingModel,
  ) {}

  public async execute(): Promise<string> {
    const index = await this.resources.readCompatibleIndex();
    const modelId = await this.model.ensure();
    this.requireMatchingEmbeddingModel(index, modelId);
    await this.resources.verifyIngestPipeline(modelId);
    await this.resources.verifyRemoteEmbedding(modelId);
    await this.resources.installIngestPipeline(modelId);
    await this.resources.installSearchPipeline();
    await this.createOrUpdateIndex(index, modelId);
    return modelId;
  }

  private requireMatchingEmbeddingModel(index: CandidateIndexState, modelId: string): void {
    if (index.exists && index.embeddingModelId !== modelId) {
      throw new Error("The index uses a different embedding model. Choose a new OPENSEARCH_INDEX and reindex candidates.");
    }
  }

  private async createOrUpdateIndex(index: CandidateIndexState, modelId: string): Promise<void> {
    if (index.exists) {
      await this.resources.updateIndexSettings();
    } else {
      await this.resources.createIndex(modelId);
    }
  }
}
