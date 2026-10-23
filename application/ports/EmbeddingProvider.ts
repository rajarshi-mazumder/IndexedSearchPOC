export interface EmbeddingProvider {
  embedDocument(text: string): Promise<number[]>;
  embedQuery(text: string): Promise<number[]>;
}
