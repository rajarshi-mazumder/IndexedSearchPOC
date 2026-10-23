import { SearchCandidates } from "../../application/usecases/SearchCandidates";
import { LocalEmbeddingProvider } from "../../infrastructure/embeddings/local/LocalEmbeddingProvider";
import { OpenSearchHybridSearch } from "../../infrastructure/opensearch/OpenSearchHybridSearch";
import { OpenSearchDocumentIndex } from "../../infrastructure/opensearch/OpenSearchDocumentIndex";

async function main() {
  const embeddingProvider = new LocalEmbeddingProvider();
  const documentIndex = new OpenSearchDocumentIndex();
  await documentIndex.initialize();
  const hybridSearch = new OpenSearchHybridSearch();
  const search = new SearchCandidates(embeddingProvider, hybridSearch);
  const query = process.argv.slice(2).join(" ").trim() || "Business analysis experience";
  console.log(`Query: "${query}"\n`);
  const results = await search.execute(query, 10);

  for (const [index, result] of results.entries()) {
    const candidate = result.document.candidate;
    console.log("-".repeat(80));
    console.log(`#${index + 1}`);
    console.log("Hybrid Score:", result.score.toFixed(6));
    console.log("Name:", candidate.name);
    console.log("Skills:", candidate.skills.join(", "));
    console.log("Job Functions:", candidate.jobFunctions.join(", "));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
