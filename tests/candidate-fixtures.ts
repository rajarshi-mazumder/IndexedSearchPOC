import { Candidate } from "../shared/domain/models/candidate";
import { CandidateDocument } from "../backend/candidateData/models/candidateDocument";
import { CandidateDocumentIndex } from "../backend/dataEmbedding/indexing/application/ports/candidateDocumentIndex";
import { OpenSearchConfig, OpenSearchSetupConfig } from "../backend/infrastructure/config/opensearchConfig";

export const config: OpenSearchConfig = {
  AWS_REGION: "ap-northeast-1",
  OPENSEARCH_NODE: "https://offline.ap-northeast-1.aoss.amazonaws.com",
  OPENSEARCH_INDEX: "test-candidates",
  OPENSEARCH_INGEST_PIPELINE: "test-ingest",
  OPENSEARCH_SEARCH_PIPELINE: "test-hybrid",
  OPENSEARCH_MODEL_ID: "test-model",
};
export const setupConfig: OpenSearchSetupConfig = {
  ...config, BEDROCK_ROLE_ARN: "arn:aws:iam::123456789012:role/TestBedrockRole",
};
export const candidateFixture = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: "003000000000001", name: "Recovered Candidate",
  title: undefined, company: undefined, location: undefined, salary: undefined,
  skills: [], skillCategories: [], systems: [], industries: [], subIndustries: [],
  jobFunctions: [], languages: [], ...overrides,
});
export const documentFixture = (): CandidateDocument => ({
  salesforceId: "003000000000001",
  candidate: candidateFixture({ skills: ["TypeScript"], languages: [{ code: "EN", level: "Fluent" }] }),
  profile: "Recovered profile", searchText: "Skills: TypeScript",
  indexedAt: new Date("2026-10-23T00:00:00.000Z"),
});
export function recordingDocumentIndex() {
  const documents: CandidateDocument[] = [];
  const batches: number[] = [];
  const index: CandidateDocumentIndex = {
    removeMany: async () => {},
    indexMany: async (batch) => { batches.push(batch.length); documents.push(...batch); },
  };
  return { index, documents, batches };
}
