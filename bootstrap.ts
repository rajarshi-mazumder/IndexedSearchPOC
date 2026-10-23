import { FullIndexCandidates } from "./application/usecases/FullIndexCandidates";
import { TemplateProfileGenerator } from "./domain/services/TemplateProfileGenerator";
import { LocalEmbeddingProvider } from "./infrastructure/embeddings/local/LocalEmbeddingProvider";
import { OpenSearchDocumentIndex } from "./infrastructure/opensearch/OpenSearchDocumentIndex";
import { SalesforceCandidateRepository } from "./infrastructure/salesforce/SalesforceCandidateRepository";
import { SalesforceClient } from "./infrastructure/salesforce/SalesforceClient";

const repository = new SalesforceCandidateRepository(new SalesforceClient());
const profileGenerator = new TemplateProfileGenerator();
const embeddingProvider = new LocalEmbeddingProvider();
const documentIndex = new OpenSearchDocumentIndex();

export const fullIndexCandidates = new FullIndexCandidates(
  repository,
  profileGenerator,
  embeddingProvider,
  documentIndex,
);
