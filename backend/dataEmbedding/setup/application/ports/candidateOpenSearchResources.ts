export interface CandidateIndexState {
  exists: boolean;
  embeddingModelId: unknown;
}

export interface CandidateOpenSearchResources {
  readCompatibleIndex(): Promise<CandidateIndexState>;
  verifyIngestPipeline(modelId: string): Promise<void>;
  verifyRemoteEmbedding(modelId: string): Promise<void>;
  installIngestPipeline(modelId: string): Promise<void>;
  installSearchPipeline(): Promise<void>;
  createIndex(modelId: string): Promise<void>;
  updateIndexSettings(): Promise<void>;
}
