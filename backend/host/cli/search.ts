import "dotenv/config";
import { createSearchContext } from "../../composition/createCandidateApplication";
import { parseArgs } from "node:util";
import { OpenSearchCommandEnvironment } from "./openSearchCommandEnvironment";

async function main() {
  const { values, positionals } = parseArgs({ options: { index: { type: "string" } }, allowPositionals: true });
  const query = positionals.join(" ").trim() || "Business analysis experience";
  const context = createSearchContext(OpenSearchCommandEnvironment.create(process.env, values.index));
  try {
    console.log("OpenSearch index:", context.index);
    console.log('Query: "' + query + '"\n');
    const results = await context.searchCandidates.execute(query, 10);
    for (const [index, result] of results.entries()) {
      const candidate = result.document.candidate;
      console.log("-".repeat(80));
      console.log("#" + (index + 1));
      console.log("Hybrid Score:", result.score.toFixed(6));
      console.log("Name:", candidate.name);
      console.log("Salesforce ID:", candidate.id);
      if (candidate.enrichment?.cvProfile) console.log("Demo CV: synthetic professional details included (seed " + candidate.enrichment.cvProfile.source.seed + ")");
      console.log("Title:", candidate.title ?? "Not provided");
      console.log("Skills:", candidate.skills.join(", "));
      console.log("Systems / technologies:", candidate.systems.join(", "));
      console.log("Job Functions:", candidate.jobFunctions.join(", "));
      console.log("Languages:", candidate.languages.map((language) => `${language.code} (${language.level || "Level not provided"})`).join(", "));
      if (candidate.enrichment?.warnings.length) console.log("Data quality notes:", candidate.enrichment.warnings.join("; "));
    }
    if (!results.length) console.log("No candidates found.");
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Search failed");
  process.exitCode = 1;
});
