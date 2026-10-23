import { SalesforceClient } from "../../infrastructure/salesforce/SalesforceClient";
import { SalesforceCandidateRepository } from "../../infrastructure/salesforce/SalesforceCandidateRepository";
import { TemplateProfileGenerator } from "../../domain/services/TemplateProfileGenerator";
import { LocalEmbeddingProvider } from "../../infrastructure/embeddings/local/LocalEmbeddingProvider";
import { OpenSearchDocumentIndex } from "../../infrastructure/opensearch/OpenSearchDocumentIndex";
import { IndexCandidates } from "../../application/usecases/IndexCandidates";

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    throw new Error("Provide at least one Salesforce Contact ID");
  }
  const client = new SalesforceClient();
  const repository = new SalesforceCandidateRepository(client);
  const profileGenerator = new TemplateProfileGenerator();
  const embeddingProvider = new LocalEmbeddingProvider();
  const documentIndex = new OpenSearchDocumentIndex();
  const indexCandidates = new IndexCandidates(
    repository,
    profileGenerator,
    embeddingProvider,
    documentIndex,
  );
  await indexCandidates.execute(ids);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
