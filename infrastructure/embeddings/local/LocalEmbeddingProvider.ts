// The import is above the photographed viewport; inferred from the visible API.
import { EmbeddingModel, FlagEmbedding } from "fastembed";
import { EmbeddingProvider } from "../../../application/ports/EmbeddingProvider";

export class LocalEmbeddingProvider implements EmbeddingProvider {
  private model?: FlagEmbedding;

  private async getModel(): Promise<FlagEmbedding> {
    if (!this.model) {
      this.model = await FlagEmbedding.init({
        // model: EmbeddingModel.BGESmallENV15,
        model: EmbeddingModel.BGEBaseENV15,
      });
    }
    return this.model;
  }

  async embedQuery(text: string): Promise<number[]> {
    const model = await this.getModel();
    return await model.queryEmbed(text);
  }

  async embedDocument(text: string): Promise<number[]> {
    const model = await this.getModel();
    const batches = model.passageEmbed([text], 1);
    for await (const batch of batches) {
      return Array.from(batch[0]);
    }
    throw new Error("Failed to generate document embedding");
  }
}
