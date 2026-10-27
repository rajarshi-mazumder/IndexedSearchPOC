import { createSearchContext } from "../../bootstrap";
import { parseArgs } from "node:util";
import { OpenSearchCommandEnvironment } from "./open-search-command-environment";

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
      console.log("Skills:", candidate.skills.join(", "));
      console.log("Job Functions:", candidate.jobFunctions.join(", "));
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
