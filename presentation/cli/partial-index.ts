import { IndexCandidates } from "../../application/usecases/IndexCandidates";
import { TemplateProfileGenerator } from "../../domain/services/TemplateProfileGenerator";
import { LocalEmbeddingProvider } from "../../infrastructure/embeddings/local/LocalEmbeddingProvider";
import { SalesforceCandidateRepository } from "../../infrastructure/salesforce/SalesforceCandidateRepository";
import { SalesforceClient } from "../../infrastructure/salesforce/SalesforceClient";
import { OpenSearchDocumentIndex } from "../../infrastructure/opensearch/OpenSearchDocumentIndex";
import { ADDITIONAL_SKILLS } from "./additionalSkills";

const CANDIDATE_IDS = Object.keys(ADDITIONAL_SKILLS);

async function main() {
  if (CANDIDATE_IDS.length === 0) {
    console.log("No candidate IDs provided.");
    return;
  }
  console.log(`Partial indexing ${CANDIDATE_IDS.length} candidate(s)...`);
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
  await indexCandidates.execute(CANDIDATE_IDS, ADDITIONAL_SKILLS);
  console.log("Partial indexing complete.");
}

main().catch((error) => {
  console.error("Partial indexing failed:");
  console.error(error);
  process.exit(1);
});
